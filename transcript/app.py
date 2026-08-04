# app.py
"""
Minimalized ICOF Transcript app (auto-detects folder so no manual path edits).
Save this as app.py in the app folder.
"""

from flask import Flask, render_template_string, request, redirect, url_for, send_file, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os, csv
from io import BytesIO

# Auto-detect app folder and set DB + watermark paths automatically
APP_FOLDER = os.path.dirname(os.path.abspath(__file__))  # folder where app.py lives
DB_PATH = os.path.join(APP_FOLDER, "icof_transcripts.db")
WATERMARK_FRONT = os.path.join(APP_FOLDER, "Trans_front.jpg")
WATERMARK_BACK = os.path.join(APP_FOLDER, "Trans_back.jpg")

APP = Flask(__name__)
APP.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
APP.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
APP.secret_key = "dev-secret-key"
db = SQLAlchemy(APP)

# Grade mapping
GRADE_TO_POINTS = {"A": 4.00, "B+": 3.30, "B": 3.00, "C+": 2.30, "C": 2.00, "D": 1.00, "F": 0.00}

# Models
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_number = db.Column(db.String(64), unique=True, nullable=False)
    surname = db.Column(db.String(128))
    first_name = db.Column(db.String(128))
    program = db.Column(db.String(128), default="Bachelor of Theology (B.Th.)")
    semesters = db.relationship("Semester", backref="student", cascade="all, delete-orphan")

class Semester(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    term = db.Column(db.String(64))
    year = db.Column(db.String(32))
    courses = db.relationship("Course", backref="semester", cascade="all, delete-orphan")

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey("semester.id"), nullable=False)
    course_code = db.Column(db.String(64))
    course_title = db.Column(db.String(256))
    credit_value = db.Column(db.Float, default=0.0)
    grade = db.Column(db.String(16))
    status = db.Column(db.String(16))

    def grade_point(self):
        g = (self.grade or "").strip().upper()
        return GRADE_TO_POINTS.get(g, 0.0)
    def grade_points_earned(self):
        return float(self.credit_value or 0.0) * self.grade_point()
    def credit_earned(self):
        if (self.status or "").strip().upper() in {"NC","IC","W","WP","E"}:
            return 0.0
        return float(self.credit_value) if self.grade_point() > 0 else 0.0

# small helper functions
def normalize_grade(s):
    if not s: return ""
    return s.strip().upper()

def compute_semester_summary(sem):
    t_credits=0.0; t_points=0.0; t_earned=0.0
    for c in sem.courses:
        t_credits += float(c.credit_value or 0.0)
        t_points  += c.grade_points_earned()
        t_earned  += c.credit_earned()
    gpa = (t_points/t_credits) if t_credits>0 else 0.0
    return {"total_credits_attempted":t_credits,"total_grade_points":t_points,"semester_gpa":round(gpa,2),"total_credits_earned":t_earned}

def compute_cumulative(student):
    tc=0.0; tp=0.0; te=0.0
    for sem in student.semesters:
        for c in sem.courses:
            tc += float(c.credit_value or 0.0)
            tp += c.grade_points_earned()
            te += c.credit_earned()
    cgpa = (tp/tc) if tc>0 else 0.0
    return {"study_total_credits":round(tc,2),"total_grade_points":round(tp,2),"cumulative_gpa":round(cgpa,2),"total_credits_earned":round(te,2)}

# very small HTML template just for getting started
TRANSCRIPT_HTML = '''<!doctype html><html><head><meta charset="utf-8"><title>Transcript</title></head><body>
<h3>ICOF Transcript - {{ student.student_number }} - {{ student.surname }}</h3>
{% for sem in semesters %}
<h4>{{ sem.term }} {{ sem.year }}</h4>
<table border="1" cellpadding="4"><tr><th>Code</th><th>Title</th><th>Credit</th><th>Grade</th><th>GP Earned</th><th>Credit Earned</th></tr>
{% for c in sem.courses %}
<tr><td>{{ c.course_code }}</td><td>{{ c.course_title }}</td><td>{{ c.credit_value }}</td><td>{{ c.grade or c.status }}</td><td>{{ "%.2f"|format(c.grade_points_earned()) }}</td><td>{{ "%.2f"|format(c.credit_earned()) }}</td></tr>
{% endfor %}
<tr><td colspan=2><strong>Semester totals</strong></td><td>{{ sem.summ.total_credits_attempted }}</td><td></td><td>{{ "%.2f"|format(sem.summ.total_grade_points) }}</td><td>{{ sem.summ.total_credits_earned }}</td></tr>
</table>
{% endfor %}
<hr>
<p>Study total credits: {{ cumulative.study_total_credits }} | Cumulative GPA: {{ cumulative.cumulative_gpa }}</p>
</body></html>'''

# Routes
@APP.route('/')
def index():
    students = Student.query.all()
    out = "<h2>Students</h2><a href='/student/new'>Add student</a><ul>"
    for s in students:
        out += f"<li>{s.student_number} - {s.surname} - <a href='/student/{s.id}/transcript'>transcript</a></li>"
    out += "</ul>"
    return out

@APP.route('/student/new', methods=['GET','POST'])
def new_student():
    if request.method=='POST':
        s = Student(student_number=request.form['student_number'], surname=request.form.get('surname'), first_name=request.form.get('first_name'))
        db.session.add(s); db.session.commit()
        return redirect(url_for('index'))
    return "<form method=post>Student No: <input name=student_number required> Surname: <input name=surname> <button>Add</button></form>"

@APP.route('/student/<int:sid>/transcript')
def transcript_view(sid):
    s = Student.query.get_or_404(sid)
    semesters = []
    for sem in s.semesters:
        sem.summ = compute_semester_summary(sem)
        semesters.append(sem)
    cum = compute_cumulative(s)
    return render_template_string(TRANSCRIPT_HTML, student=s, semesters=semesters, cumulative=cum)

# Basic CSV import: POST a CSV file with header: semester,year,course_code,course_title,credit_value,grade,status
@APP.route('/student/<int:sid>/import_csv', methods=['POST'])
def import_csv_student(sid):
    s = Student.query.get_or_404(sid)
    f = request.files.get('csvfile')
    if not f: return "No file", 400
    text = f.read().decode('utf-8').splitlines()
    reader = csv.DictReader(text)
    for row in reader:
        term=row.get('semester','').strip(); year=row.get('year','').strip()
        sem = Semester.query.filter_by(student_id=s.id, term=term, year=year).first()
        if not sem:
            sem=Semester(student_id=s.id, term=term, year=year); db.session.add(sem); db.session.flush()
        c = Course(semester_id=sem.id, course_code=row.get('course_code'), course_title=row.get('course_title'),
                   credit_value=float(row.get('credit_value') or 0), grade=normalize_grade(row.get('grade')), status=row.get('status'))
        db.session.add(c)
    db.session.commit()
    return "Imported"

# Init
def init_db():
    db.create_all()

if __name__ == '__main__':
    init_db()
    APP.run(host='0.0.0.0', port=5000, debug=True)
