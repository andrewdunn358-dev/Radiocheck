'use client';

import { useState } from 'react';
import { Lightbulb, CheckCircle, XCircle, Award, RotateCcw, ChevronRight } from 'lucide-react';
import { lmsApi } from '@/lib/api';

interface ReflectionQuestion {
  id: string;
  question: string;
  type: 'scenario' | 'reflection';
}

interface TutorInfo {
  name: string;
  avatar_url: string;
  title: string;
}

interface ReflectionData {
  module_name: string;
  has_reflection: boolean;
  questions: ReflectionQuestion[];
  tutor: TutorInfo;
  intro_message: string;
}

interface EvaluationResult {
  passed: boolean;
  question: string;
  feedback: string;
  competencies: string[];
}

interface ReflectionQuestionsProps {
  reflectionData: ReflectionData;
  learnerEmail: string;
  moduleId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ReflectionQuestions({
  reflectionData,
  learnerEmail,
  moduleId,
  onComplete,
  onCancel,
}: ReflectionQuestionsProps) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [results, setResults] = useState<EvaluationResult[] | null>(null);
  const [allPassed, setAllPassed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const getCharCount = (questionId: string) => {
    return responses[questionId]?.length || 0;
  };

  const handleSubmit = async () => {
    // Validate all responses have at least 50 characters
    for (const q of reflectionData.questions) {
      const response = responses[q.id]?.trim() || '';
      if (response.length < 50) {
        setError(`Please provide a more detailed response for: "${q.question.substring(0, 50)}..."`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    const evaluationResults: EvaluationResult[] = [];
    let allPassedCheck = true;

    for (const q of reflectionData.questions) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com'}/api/lms/tutor/submit-reflection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            learner_email: learnerEmail,
            module_id: moduleId,
            question_id: q.id,
            response: responses[q.id],
          }),
        });

        const data = await res.json();

        if (res.ok) {
          evaluationResults.push({
            passed: data.evaluation.passed,
            question: q.question,
            feedback: data.evaluation.tutor_message,
            competencies: data.evaluation.competencies_demonstrated || [],
          });

          if (!data.evaluation.passed) {
            allPassedCheck = false;
          }
        } else {
          throw new Error(data.detail || 'Submission failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to submit reflection');
        setIsSubmitting(false);
        return;
      }
    }

    setResults(evaluationResults);
    setAllPassed(allPassedCheck);
    setIsSubmitting(false);
  };

  const handleRetry = () => {
    setResults(null);
    setResponses({});
    setAllPassed(false);
  };

  // Results View
  if (results) {
    return (
      <div className="bg-card border border-border rounded-xl p-6" data-testid="reflection-results">
        {/* Tutor Feedback Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <img 
            src={reflectionData.tutor.avatar_url} 
            alt={reflectionData.tutor.name}
            className="w-16 h-16 rounded-full border-2 border-secondary"
          />
          <div>
            <h3 className="text-xl font-semibold">{reflectionData.tutor.name}&apos;s Feedback</h3>
            <p className={`text-sm ${allPassed ? 'text-green-400' : 'text-yellow-400'}`}>
              {allPassed 
                ? 'Well done! You\'ve demonstrated good understanding.' 
                : 'Good effort! Some areas need more development.'}
            </p>
          </div>
        </div>

        {/* Individual Feedback */}
        <div className="space-y-4 mb-6">
          {results.map((result, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-xl border ${
                result.passed 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {result.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-yellow-400" />
                )}
                <span className={`font-medium ${result.passed ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.passed ? 'Passed' : 'Needs Development'}
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-2">{result.question.substring(0, 80)}...</p>
              <p className="text-sm">{result.feedback}</p>
              {result.competencies.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs text-gray-400">Competencies demonstrated:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.competencies.map((comp, i) => (
                      <span key={i} className="px-2 py-1 bg-secondary/20 text-secondary text-xs rounded">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-4">
          {allPassed ? (
            <>
              <p className="flex items-center gap-2 text-green-400">
                <Award className="w-5 h-5" />
                You can now proceed to the module quiz!
              </p>
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
                data-testid="proceed-to-quiz"
              >
                Take Module Quiz
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-yellow-400">
                <RotateCcw className="w-5 h-5" />
                Please review the feedback and try again.
              </p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-3 border border-secondary text-secondary rounded-lg hover:bg-secondary/10"
                data-testid="retry-reflection"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Questions Form View
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="reflection-form">
      {/* Header */}
      <div className="p-6 border-b border-border bg-primary/50">
        <div className="flex items-center gap-4 mb-4">
          <img 
            src={reflectionData.tutor.avatar_url} 
            alt={reflectionData.tutor.name}
            className="w-12 h-12 rounded-full border-2 border-secondary"
          />
          <div>
            <h2 className="text-xl font-semibold">{reflectionData.module_name} - Reflection</h2>
            <p className="text-sm text-gray-400">Reviewed by {reflectionData.tutor.name}</p>
          </div>
        </div>
        <div className="bg-primary-dark/50 rounded-lg p-4">
          <p className="text-sm text-gray-300">{reflectionData.intro_message}</p>
        </div>
      </div>

      {/* Questions */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {reflectionData.questions.map((q, idx) => (
          <div key={q.id} className="space-y-3" data-testid={`reflection-question-${idx}`}>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${
                q.type === 'scenario' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'bg-blue-500/20 text-blue-400'
              }`}>
                {q.type === 'scenario' ? 'Scenario' : 'Reflection'}
              </span>
              <span className="text-sm text-gray-400">Question {idx + 1} of {reflectionData.questions.length}</span>
            </div>
            <p className="font-medium">{q.question}</p>
            <textarea
              value={responses[q.id] || ''}
              onChange={(e) => handleResponseChange(q.id, e.target.value)}
              placeholder="Write your thoughtful response here (minimum 50 characters)..."
              rows={6}
              className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none"
              data-testid={`reflection-input-${idx}`}
            />
            <div className={`text-xs ${getCharCount(q.id) >= 50 ? 'text-green-400' : 'text-gray-500'}`}>
              {getCharCount(q.id)} characters {getCharCount(q.id) < 50 && '(minimum 50)'}
            </div>
          </div>
        ))}

        {/* Submit Button */}
        <div className="flex gap-4 justify-end pt-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-border rounded-lg hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light disabled:opacity-50"
            data-testid="submit-reflection"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-dark border-t-transparent rounded-full animate-spin" />
                {reflectionData.tutor.name} is reviewing...
              </>
            ) : (
              <>
                Submit to {reflectionData.tutor.name} for Review
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
