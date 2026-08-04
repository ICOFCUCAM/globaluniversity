<?php
// Start session and generate CSRF token
session_start();
if (empty($_SESSION['csrf'])) {
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ICOF Global University — Online Application</title>
  <style>
    :root{--brand:#1a73e8;--ok:#0a7b12;--bad:#b00020}
    body{font-family:system-ui, Segoe UI, Roboto, Arial, sans-serif; margin:0; background:#f6f7fb; color:#111}
    header img{display:block;width:100%;height:auto;margin:0 auto}
    .wrap{max-width:1100px;margin:0 auto;padding:18px}
    form{background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.03);overflow:hidden}
    fieldset{border:0;border-top:1px solid #eef0f3;margin:0;padding:18px}
    fieldset:first-of-type{border-top:0}
    legend{font-weight:700;padding:0 6px;color:#0f172a}
    label{display:block;margin-top:12px;font-weight:600;color:#0f172a}
    .req::after{content:" *";color:#dc2626}
    input,select,textarea{width:100%;padding:10px 12px;margin-top:6px;border:1px solid #cfd3d8;border-radius:8px;background:#fff}
    input:focus,select:focus,textarea:focus{border-color:var(--brand); box-shadow:0 0 0 3px rgba(26,115,232,.15)}
    .grid{display:grid;gap:14px}
    .grid-2{grid-template-columns:1fr 1fr}
    .grid-3{grid-template-columns:1fr 1fr 1fr}
    @media(max-width:760px){.grid-2,.grid-3{grid-template-columns:1fr}}
    .inline{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px}
    .muted{color:#64748b;font-size:13px}
    .actions{display:flex;justify-content:space-between;gap:10px;padding:14px 18px;border-top:1px solid #eef0f3;background:#fafafa}
    .btn{border:1px solid #e5e7eb;background:#fff;padding:10px 14px;border-radius:8px;cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
    progress{width:100%;height:8px;margin-top:4px}
    .file-info{font-size:12px;color:#64748b;margin-top:2px}
    .wizardbar{display:flex;align-items:center;gap:10px;padding:12px 18px;background:#fafafa;border-bottom:1px solid #eef0f3}
    .pill{padding:6px 10px;border-radius:999px;border:1px solid #e5e7eb;font-size:12px}
    .pill.active{background:var(--brand);color:#fff;border-color:var(--brand)}
    .pill.done{background:#e8f0fe;color:#174ea6;border-color:#c3d3ff}
    .wizard-progress{height:4px;background:#e5e7eb;position:relative;border-radius:999px;overflow:hidden;margin-left:auto;flex:1}
    .wizard-progress span{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--brand)}
    .step{display:none}
    .step.active{display:block}
    .summary .row{padding:6px 0;border-bottom:1px dashed #e5e7eb}
  </style>
</head>
<body>
  <header>
    <img src="99053ac4-2a8e-4ebd-b8ea-4c264ca2a6d8.png" alt="ICOF Application Banner" />
  </header>
  <main>
    <div class="wrap">
      <form id="icofForm" action="send_form.php" method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf'] ?? ''; ?>">

        <!-- Wizard header -->
        <div class="wizardbar">
          <div class="steps" id="wizardSteps"></div>
          <div class="wizard-progress"><span id="wizardProgress"></span></div>
        </div>

        <div id="wizardBody">
          <!-- Personal -->
          <fieldset class="step" data-title="Personal">
            <legend>Personal Information</legend>
            <div class="grid grid-2">
              <label class="req">Surname<input type="text" name="surname" required></label>
              <label class="req">First Name<input type="text" name="firstname" required></label>
            </div>
            <div class="grid grid-2">
              <label>Middle Name<input type="text" name="middlename"></label>
              <label>Maiden Name<input type="text" name="maidenname"></label>
            </div>
            <div class="grid grid-2">
              <label class="req">ID / Passport<input type="text" name="id_number" required></label>
              <label>Place of Issue<input type="text" name="place_issue"></label>
            </div>
            <div class="grid grid-2">
              <label>Date of Issue<input type="date" name="date_issue"></label>
              <label class="req">Date of Birth<input type="date" name="dob" required></label>
            </div>
            <div class="inline">
              <label><input type="radio" name="gender" value="Male" required> Male</label>
              <label><input type="radio" name="gender" value="Female" required> Female</label>
            </div>
            <div class="grid grid-2">
              <label>Nationality<input type="text" name="nationality"></label>
              <label>Tribe / Race<input type="text" name="tribe"></label>
            </div>
            <label class="req">Address<textarea name="address" required></textarea></label>
            <div class="grid grid-3">
              <label>Work Phone<input type="tel" name="phone_work"></label>
              <label class="req">Mobile<input type="tel" name="phone_mobile" required></label>
              <label>Fax<input type="text" name="fax"></label>
            </div>
            <label class="req">Email<input type="email" name="email" required></label>
            <h4>Emergency Contact</h4>
            <label class="req">Name<input type="text" name="em_name" required></label>
            <label class="req">Address<textarea name="em_address" required></textarea></label>
            <label class="req">Mobile<input type="tel" name="em_mobile" required></label>
          </fieldset>

          <!-- Academic -->
          <fieldset class="step" data-title="Academic">
            <legend>Academic Information</legend>
            <div class="grid grid-2">
              <label>Last level of secondary education<input type="text" name="sec_level"></label>
              <label>Year<input type="number" name="sec_year" min="1900" max="2100"></label>
            </div>
            <label>Secondary School<input type="text" name="sec_school"></label>
            <h4>Post-Secondary</h4>
            <div class="grid grid-2">
              <label>Institution #1<input type="text" name="post_inst1"></label>
              <label>Qualification #1<input type="text" name="post_qual1"></label>
            </div>
            <div class="grid grid-2">
              <label>Year Awarded<input type="number" name="post_year1"></label>
              <label>Field<input type="text" name="post_field1"></label>
            </div>
            <div class="grid grid-2">
              <label>Institution #2<input type="text" name="post_inst2"></label>
              <label>Qualification #2<input type="text" name="post_qual2"></label>
            </div>
            <div class="grid grid-2">
              <label>Year Awarded<input type="number" name="post_year2"></label>
              <label>Field<input type="text" name="post_field2"></label>
            </div>
          </fieldset>

          <!-- Program -->
          <fieldset class="step" data-title="Program">
            <legend>Program Desired</legend>
            <label class="req">Level
              <select name="level" required>
                <option value="">Select level</option>
                <option>Doctor of Philosophy</option>
                <option>Doctor of Theology</option>
                <option>Master of Arts</option>
                <option>Bachelor of Science</option>
                <option>Diploma</option>
                <option>Certificate</option>
              </select>
            </label>
            <label>Field
              <select name="field">
                <optgroup label="Theology"><option>Divinity</option><option>Ministry</option><option>Theology</option></optgroup>
                <optgroup label="Education"><option>Primary Education</option><option>Special Education</option></optgroup>
                <optgroup label="Engineering"><option>Software Engineering</option><option>Networking</option></optgroup>
                <optgroup label="Business"><option>Business Management</option><option>Project Management</option></optgroup>
                <option>Other</option>
              </select>
            </label>
            <label>Other / Specialization<input type="text" name="field_other"></label>
          </fieldset>

          <!-- Uploads -->
          <fieldset class="step" data-title="Uploads">
            <legend>Uploads</legend>
            <div class="inline">
              <label><input type="radio" name="mode" value="Full Time" required> Full Time</label>
              <label><input type="radio" name="mode" value="Part Time" required> Part Time</label>
              <label><input type="radio" name="mode" value="ODL" required> ODL</label>
            </div>
            <p class="muted">Accepted: PDF/JPG/PNG/DOC/DOCX/ZIP. Max 10MB.</p>
            <label class="req">4x4 Passport Photo<input id="filePhoto" name="filePhoto" type="file" accept=".jpg,.jpeg,.png" required></label>
            <label class="req">Identity Document<input id="fileID" name="fileID" type="file" accept=".pdf,.jpg,.jpeg,.png" required></label>
            <label class="req">Transcripts<input id="fileTrans" name="fileTrans" type="file" accept=".pdf,.doc,.docx,.zip" required></label>
          </fieldset>

          <!-- Review -->
          <fieldset class="step" data-title="Review">
            <legend>Review</legend>
            <div id="reviewContent" class="summary"></div>
          </fieldset>

          <!-- Declaration -->
          <fieldset class="step" data-title="Declaration">
            <legend>Declaration</legend>
            <p class="muted">
              By submitting, I certify that the information provided is true and agree to abide by ICOF Global University policies.
              <button type="button" id="policyToggle" class="btn" style="margin-left:8px;font-size:12px;padding:4px 8px">▼ View Policy</button>
            </p>
            <div id="policyContent" style="display:none;border:1px solid #e5e7eb;padding:10px;margin-top:8px;border-radius:6px;font-size:13px;background:#fafafa;max-height:300px;overflow:auto">
              <h4>ICOF Policy Summary</h4>
              <p><strong>Access & Inclusion:</strong> Equal opportunities, non-discrimination.</p>
              <p><strong>Quality:</strong> Rigorous, internationally reviewed programs.</p>
              <p><em>Read the full document:</em> <a href="icof_policy.pdf" target="_blank">📄 Download ICOF Policy</a></p>
            </div>
            <label class="req">Applicant’s Name<input type="text" name="applicant_name" required></label>
            <label class="inline"><input type="checkbox" name="agree" required> I agree to the declaration</label>
            <div class="g-recaptcha" data-sitekey="6Lfao8krAAAAAH9cAEkgmWo9CqrLf2fDO1NVjXcR"></div>
          </fieldset>
        </div>

        <!-- Navigation -->
        <div class="actions">
          <button type="button" id="prevBtn" class="btn">◀ Back</button>
          <div style="display:flex;gap:8px">
            <button type="button" id="nextBtn" class="btn primary">Next ▶</button>
            <button type="submit" id="submitBtn" class="btn primary" style="display:none">Submit</button>
          </div>
        </div>
      </form>
    </div>
  </main>

  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  <script>
    // Policy toggle
    document.addEventListener('click', e=>{
      if(e.target.id==='policyToggle'){
        const box=document.getElementById('policyContent');
        const open=box.style.display!=='block';
        box.style.display=open?'block':'none';
        e.target.textContent=open?'▲ Hide Policy':'▼ View Policy';
      }
    });

    // Wizard logic (simplified)
    const steps=Array.from(document.querySelectorAll('.step'));
    let idx=0;
    function updateUI(){
      steps.forEach((s,i)=>s.classList.toggle('active',i===idx));
      document.getElementById('prevBtn').disabled=idx===0;
      document.getElementById('nextBtn').style.display=idx<steps.length-1?'inline-block':'none';
      document.getElementById('submitBtn').style.display=idx===steps.length-1?'inline-block':'none';
      if(idx===steps.length-2) buildReview();
    }
    function goto(i){idx=Math.max(0,Math.min(steps.length-1,i));updateUI();}
    document.getElementById('prevBtn').onclick=()=>goto(idx-1);
    document.getElementById('nextBtn').onclick=()=>goto(idx+1);
    function buildReview(){
      const out=document.getElementById('reviewContent');
      const data=new FormData(document.getElementById('icofForm'));
      let html='';
      for(const [k,v] of data.entries()){
        if(v instanceof File||k==='csrf_token'||k==='g-recaptcha-response') continue;
        html+=`<div class="row"><strong>${k}</strong>: ${v}</div>`;
      }
      out.innerHTML=html;
    }
    updateUI();
  </script>
</body>
</html>