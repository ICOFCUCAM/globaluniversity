<?php
// -----------------------
// ICOF Application Handler
// -----------------------

// === CONFIG ===
$DESTINATION_EMAIL = "admission@iguc.net";        
$FROM_DOMAIN       = $_SERVER['HTTP_HOST'] ?? 'example.com';
$FROM_ADDRESS      = "no-reply@{$FROM_DOMAIN}";   
$RECAPTCHA_SECRET  = "6Lfao8krAAAAAOg-ozwrhjt1jLg19Ozw53n6YvJk";     
$UPLOAD_DIR        = __DIR__ . "/uploads";
$MAX_SIZE_BYTES    = 10 * 1024 * 1024;            
$ALLOWED_EXTS      = ['pdf','jpg','jpeg','png','doc','docx','zip'];
$SEND_APPLICANT_COPY = true;

// === START ===
session_start();

// --- CSRF check ---
if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== ($_SESSION['csrf'] ?? '')) {
  http_response_code(403);
  exit("❌ Invalid CSRF token.");
}

// --- reCAPTCHA check ---
if (!empty($RECAPTCHA_SECRET)) {
  $recaptchaResponse = $_POST['g-recaptcha-response'] ?? '';
  if ($recaptchaResponse === '') exit("❌ reCAPTCHA missing.");
  if (!verify_recaptcha($RECAPTCHA_SECRET, $recaptchaResponse)) {
    exit("❌ reCAPTCHA verification failed.");
  }
}

// --- Group fields into sections ---
$sections = [
  "Personal Information" => [
    'surname','firstname','middlename','maidenname','id_number','place_issue','date_issue',
    'dob','gender','nationality','tribe','address','phone_work','phone_mobile','fax','email',
    'em_name','em_address','em_mobile'
  ],
  "Academic Information" => [
    'sec_level','sec_year','sec_school',
    'post_inst1','post_qual1','post_year1','post_field1',
    'post_inst2','post_qual2','post_year2','post_field2'
  ],
  "Program Desired" => [
    'level','field','field_other'
  ],
  "Mode of Study" => [
    'mode'
  ],
  "Declaration" => [
    'applicant_name','agree'
  ]
];

// Collect all fields
$data = [];
foreach ($sections as $group => $fields) {
  foreach ($fields as $f) {
    $data[$f] = trim((string)($_POST[$f] ?? ""));
  }
}

// Basic validation
if ($data['surname']==="" || $data['firstname']==="" || $data['email']==="") {
  exit("❌ Missing required fields: surname, firstname, email.");
}
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
  exit("❌ Invalid applicant email.");
}

// --- Handle uploads ---
$required_files = [
  'filePhoto' => '4x4 Digital Passport Photo',
  'fileID'    => 'Identity Document',
  'fileTrans' => 'Transcripts'
];
if (!is_dir($UPLOAD_DIR)) @mkdir($UPLOAD_DIR, 0775, true);

$attachments = [];
foreach ($required_files as $key => $label) {
  $att = handle_upload($key, $UPLOAD_DIR, $ALLOWED_EXTS, $MAX_SIZE_BYTES);
  if ($att === null) {
    exit("❌ Missing or invalid upload: {$label}");
  }
  $attachments[] = $att;
}

// --- Build email to admissions ---
list($headers, $subject, $body, $boundary) = build_email_to_office(
  $FROM_ADDRESS,
  $data['email'],
  "ICOF Application: {$data['surname']} {$data['firstname']}",
  $sections,
  $data
);

// Attach files
foreach ($attachments as $att) {
  $body .= build_attachment_part($att['path'], $att['name'], $att['type'], $boundary);
}
$body .= "--$boundary--";

// --- Send to Admissions ---
$sent_office = mail($DESTINATION_EMAIL, $subject, $body, $headers);

// --- Applicant copy (plain text, no files) ---
$sent_applicant = true;
if ($SEND_APPLICANT_COPY && $sent_office) {
  $copy_subject = "Your ICOF Application Receipt";
  $copy_headers = "From: {$FROM_ADDRESS}\r\n";
  $copy_headers .= "Reply-To: {$DESTINATION_EMAIL}\r\n";
  $copy_headers .= "MIME-Version: 1.0\r\n";
  $copy_headers .= "Content-Type: text/plain; charset=\"utf-8\"\r\n";

  $copy_body = "Dear {$data['firstname']} {$data['surname']},\r\n\r\n";
  $copy_body .= "We have received your application. Below is a summary:\r\n\r\n";
  foreach ($sections as $group => $fields) {
    $copy_body .= "=== {$group} ===\r\n";
    foreach ($fields as $f) {
      $v = $data[$f];
      if ($f==='agree') $v = $v ? 'Yes' : 'No';
      $copy_body .= strtoupper($f).": ".$v."\r\n";
    }
    $copy_body .= "\r\n";
  }
  $copy_body .= "Admissions Office: {$DESTINATION_EMAIL}\r\n";
  $sent_applicant = mail($data['email'], $copy_subject, $copy_body, $copy_headers);
}

// --- Output result ---
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Submission <?php echo $sent_office ? 'Successful' : 'Failed'; ?></title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial;max-width:720px;margin:40px auto;padding:16px;text-align:center}
    .ok{color:#0a7b12}
    .bad{color:#b00020}
    a.btn{display:inline-block;margin-top:18px;padding:10px 14px;background:#1a73e8;color:#fff;border-radius:8px;text-decoration:none}
  </style>
</head>
<body>
  <?php if ($sent_office): ?>
    <h2 class="ok">✅ Your application has been submitted.</h2>
    <p>A confirmation has been emailed to admissions (<?php echo $DESTINATION_EMAIL; ?>).</p>
    <?php if ($SEND_APPLICANT_COPY): ?>
      <p>A receipt has also been sent to your email (<?php echo htmlspecialchars($data['email']); ?>).</p>
    <?php endif; ?>
  <?php else: ?>
    <h2 class="bad">❌ Submission failed.</h2>
    <p>Please try again later or contact admissions.</p>
  <?php endif; ?>
  <a class="btn" href="index.php">Back to Application</a>
</body>
</html>

<?php
// =================== HELPERS ===================

function verify_recaptcha($secret, $response) {
  $url  = 'https://www.google.com/recaptcha/api/siteverify';
  $data = ['secret'=>$secret,'response'=>$response,'remoteip'=>$_SERVER['REMOTE_ADDR'] ?? null];
  $opts = ['http'=>['method'=>'POST','header'=>"Content-type: application/x-www-form-urlencoded\r\n",'content'=>http_build_query($data)]];
  $res = @file_get_contents($url,false,stream_context_create($opts));
  if(!$res) return false;
  $json = json_decode($res,true);
  return !empty($json['success']);
}

function handle_upload($key, $dir, $allowedExt, $maxSize) {
  if (!isset($_FILES[$key])) return null;
  $f = $_FILES[$key];
  if ($f['error'] !== UPLOAD_ERR_OK) return null;
  if ($f['size'] <= 0 || $f['size'] > $maxSize) return null;
  $name = basename($f['name']);
  $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  if (!in_array($ext,$allowedExt,true)) return null;
  $safeName = preg_replace('/[^A-Za-z0-9._-]/','_', $name);
  $dest = $dir."/".uniqid("up_",true)."_".$safeName;
  if (!move_uploaded_file($f['tmp_name'],$dest)) return null;
  $type = mime_content_type($dest) ?: 'application/octet-stream';
  return ['path'=>$dest,'name'=>$name,'type'=>$type];
}

function build_email_to_office($from,$replyTo,$subject,$sections,$data) {
  $boundary = "==Multipart_Boundary_x".md5(time())."x";
  $headers  = "From: {$from}\r\n";
  if (filter_var($replyTo,FILTER_VALIDATE_EMAIL)) {
    $headers .= "Reply-To: {$replyTo}\r\n";
  }
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

  $body  = "--{$boundary}\r\n";
  $body .= "Content-Type: text/plain; charset=\"utf-8\"\r\n";
  $body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";

  foreach ($sections as $group => $fields) {
    $body .= "=== {$group} ===\r\n";
    foreach ($fields as $f) {
      $v = $data[$f];
      if ($f==='agree') $v = $v ? 'Yes' : 'No';
      $body .= strtoupper($f).": ".$v."\r\n";
    }
    $body .= "\r\n";
  }
  return [$headers,$subject,$body,$boundary];
}

function build_attachment_part($path,$name,$type,$boundary) {
  $fileContent = @file_get_contents($path);
  if ($fileContent===false) return "";
  $b64 = chunk_split(base64_encode($fileContent));
  $part  = "--{$boundary}\r\n";
  $part .= "Content-Type: {$type}; name=\"{$name}\"\r\n";
  $part .= "Content-Transfer-Encoding: base64\r\n";
  $part .= "Content-Disposition: attachment; filename=\"{$name}\"\r\n\r\n";
  $part .= $b64."\r\n\r\n";
  return $part;
}

