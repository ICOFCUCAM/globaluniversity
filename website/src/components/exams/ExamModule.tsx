import { SampleDataNotice } from '@/components/ui/portal';
import React, { useState, useEffect, useCallback } from 'react';
import { examData } from '@/lib/sampleData';
import {
  Clock, Play, CheckCircle2, AlertTriangle, Shield,
  ChevronRight, ChevronLeft, Flag, X, Eye
} from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
}

const sampleQuestions: Question[] = [
  { id: 1, text: 'Which of the following is NOT a type of machine learning?', options: ['Supervised Learning', 'Unsupervised Learning', 'Reinforcement Learning', 'Compiled Learning'], correct: 3 },
  { id: 2, text: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correct: 1 },
  { id: 3, text: 'SQL stands for:', options: ['Structured Query Language', 'Simple Query Language', 'Standard Query Logic', 'Sequential Query Language'], correct: 0 },
  { id: 4, text: 'Which data structure uses FIFO?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correct: 1 },
  { id: 5, text: 'What is the purpose of normalization in databases?', options: ['Increase redundancy', 'Reduce redundancy', 'Delete data', 'Encrypt data'], correct: 1 },
  { id: 6, text: 'TCP operates at which layer of the OSI model?', options: ['Application', 'Transport', 'Network', 'Data Link'], correct: 1 },
  { id: 7, text: 'Which sorting algorithm has the best average case?', options: ['Bubble Sort', 'Quick Sort', 'Selection Sort', 'Insertion Sort'], correct: 1 },
  { id: 8, text: 'What does API stand for?', options: ['Application Programming Interface', 'Advanced Program Integration', 'Automated Process Interface', 'Application Process Integration'], correct: 0 },
  { id: 9, text: 'Which is a NoSQL database?', options: ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'], correct: 2 },
  { id: 10, text: 'What is polymorphism in OOP?', options: ['Multiple inheritance', 'Same interface, different implementations', 'Data hiding', 'Code reuse'], correct: 1 },
];

export default function ExamModule() {
  const [activeExam, setActiveExam] = useState<typeof examData[0] | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (activeExam && timeLeft > 0 && !submitted) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    }
    if (timeLeft === 0 && activeExam && !submitted) {
      handleSubmit();
    }
  }, [timeLeft, activeExam, submitted]);

  function startExam(exam: typeof examData[0]) {
    setActiveExam(exam);
    setTimeLeft(exam.duration * 60);
    setAnswers({});
    setFlagged(new Set());
    setCurrentQuestion(0);
    setSubmitted(false);
    setShowResults(false);
  }

  function handleSubmit() {
    setSubmitted(true);
    setShowResults(true);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const score = Object.entries(answers).reduce((s, [qIdx, aIdx]) => {
    return s + (sampleQuestions[Number(qIdx)]?.correct === aIdx ? 1 : 0);
  }, 0);

  if (activeExam && !submitted) {
    const q = sampleQuestions[currentQuestion];
    const isLowTime = timeLeft < 300;

    return (
      <div className="space-y-4">
        {/* Exam Header */}
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-[#33234a] dark:text-[#e4dcf0]">{activeExam.courseCode}: {activeExam.title}</h3>
            <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Question {currentQuestion + 1} of {sampleQuestions.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${isLowTime ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
              <Clock size={14} /> {formatTime(timeLeft)}
            </div>
            <div className="flex items-center gap-1 text-xs text-[#a49bb0] dark:text-[#7b7289]">
              <Shield size={12} /> Proctored
            </div>
            <button onClick={handleSubmit}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
              Submit Exam
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Question */}
          <div className="lg:col-span-3 rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-6">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                Q{currentQuestion + 1}. {q.text}
              </h4>
              <button onClick={() => {
                const newFlagged = new Set(flagged);
                if (newFlagged.has(currentQuestion)) newFlagged.delete(currentQuestion);
                else newFlagged.add(currentQuestion);
                setFlagged(newFlagged);
              }} className={`p-2 rounded-lg transition-colors ${flagged.has(currentQuestion) ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-amber-50'}`}>
                <Flag size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {q.options.map((option, oi) => (
                <button key={oi} onClick={() => setAnswers({ ...answers, [currentQuestion]: oi })}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    answers[currentQuestion] === oi
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-100 hover:border-gray-300 text-gray-700'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      answers[currentQuestion] === oi ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))} disabled={currentQuestion === 0}
                className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 transition-colors">
                <ChevronLeft size={14} /> Previous
              </button>
              <button onClick={() => setCurrentQuestion(Math.min(sampleQuestions.length - 1, currentQuestion + 1))} disabled={currentQuestion === sampleQuestions.length - 1}
                className="flex items-center gap-1 px-4 py-2 bg-[#422e59] text-white rounded-lg text-sm disabled:opacity-40 hover:bg-[#322244] transition-colors">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Question Navigator */}
          <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4">
            <h4 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] text-sm mb-3">Questions</h4>
            <div className="grid grid-cols-5 gap-2">
              {sampleQuestions.map((_, i) => (
                <button key={i} onClick={() => setCurrentQuestion(i)}
                  className={`w-full aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
                    currentQuestion === i ? 'bg-[#422e59] text-white ring-2 ring-blue-300' :
                    answers[i] !== undefined ? 'bg-emerald-100 text-emerald-700' :
                    flagged.has(i) ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-100" /> Answered</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-100" /> Flagged</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-100" /> Unanswered</div>
            </div>
            <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-3">
              {Object.keys(answers).length}/{sampleQuestions.length} answered
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-8 text-center">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${score >= 7 ? 'bg-emerald-100' : score >= 5 ? 'bg-blue-100' : 'bg-red-100'}`}>
            <CheckCircle2 size={40} className={score >= 7 ? 'text-emerald-600' : score >= 5 ? 'text-blue-600' : 'text-red-600'} />
          </div>
          <h2 className="text-2xl font-bold text-[#33234a] dark:text-[#e4dcf0] mt-4">Exam Completed!</h2>
          <p className="text-gray-500 mt-1">{activeExam?.courseCode}: {activeExam?.title}</p>
          <div className="flex justify-center gap-8 mt-6">
            <div>
              <p className="text-3xl font-bold text-[#422e59]">{score}/{sampleQuestions.length}</p>
              <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Score</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600">{((score / sampleQuestions.length) * 100).toFixed(0)}%</p>
              <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Percentage</p>
            </div>
          </div>
          <button onClick={() => { setActiveExam(null); setShowResults(false); }}
            className="mt-6 px-6 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors">
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SampleDataNotice what="sample examinations" />
      <div>
        <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Examination System</h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Computer-Based Testing (CBT) with proctoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {examData.map((exam) => (
          <div key={exam.id} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between">
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                exam.status === 'ongoing' ? 'bg-red-50 text-red-600' :
                exam.status === 'upcoming' ? 'bg-blue-50 text-blue-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {exam.status.toUpperCase()}
              </div>
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{exam.date}</span>
            </div>
            <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3">{exam.courseCode}: {exam.title}</h4>
            <div className="flex items-center gap-4 mt-2 text-xs text-[#a49bb0] dark:text-[#7b7289]">
              <span className="flex items-center gap-1"><Clock size={10} /> {exam.duration} min</span>
              <span>{exam.questions} questions</span>
              <span>{exam.enrolled} enrolled</span>
            </div>
            <button onClick={() => startExam(exam)} disabled={exam.status === 'completed'}
              className={`w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                exam.status === 'completed' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                exam.status === 'ongoing' ? 'bg-red-500 text-white hover:bg-red-600' :
                'bg-[#422e59] text-white hover:bg-[#322244]'
              }`}>
              <Play size={14} /> {exam.status === 'completed' ? 'Completed' : exam.status === 'ongoing' ? 'Join Now' : 'Start Exam'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
