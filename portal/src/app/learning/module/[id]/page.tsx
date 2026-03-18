'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLearnerAuth } from '@/hooks/useLearnerAuth';
import { lmsApi, ModuleResponse, QuizResults } from '@/lib/api';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, 
  ChevronRight, BookOpen, HelpCircle, Award, RotateCcw,
  ExternalLink, MessageSquare
} from 'lucide-react';

type ViewState = 'content' | 'quiz' | 'results';

export default function ModulePage() {
  const params = useParams();
  const router = useRouter();
  const { learner, progress, refreshProgress } = useLearnerAuth();
  const moduleId = params.id as string;

  const [moduleData, setModuleData] = useState<ModuleResponse | null>(null);
  const [viewState, setViewState] = useState<ViewState>('content');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tutor chat
  const [showTutor, setShowTutor] = useState(false);
  const [tutorMessage, setTutorMessage] = useState('');
  const [tutorChat, setTutorChat] = useState<{role: string; content: string}[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);

  useEffect(() => {
    if (!learner) {
      router.push('/learning');
      return;
    }
    loadModule();
  }, [learner, moduleId]);

  const loadModule = async () => {
    if (!learner) return;
    try {
      const data = await lmsApi.getModule(moduleId, learner.email);
      setModuleData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load module');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!learner || !moduleData) return;
    
    const unanswered = moduleData.module.quiz.questions.filter(q => !quizAnswers[q.id]);
    if (unanswered.length > 0) {
      alert(`Please answer all questions. ${unanswered.length} remaining.`);
      return;
    }

    setSubmitting(true);
    try {
      const results = await lmsApi.submitQuiz(learner.email, moduleId, quizAnswers);
      setQuizResults(results);
      setViewState('results');
      await refreshProgress();
    } catch (err: any) {
      alert(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizResults(null);
    setViewState('quiz');
  };

  const handleTutorSend = async () => {
    if (!tutorMessage.trim() || !learner) return;
    
    const userMsg = tutorMessage;
    setTutorChat(prev => [...prev, { role: 'user', content: userMsg }]);
    setTutorMessage('');
    setTutorLoading(true);

    try {
      const response = await lmsApi.chatWithTutor(learner.email, userMsg, moduleData?.module.title);
      setTutorChat(prev => [...prev, { role: 'assistant', content: response.response }]);
    } catch (err) {
      setTutorChat(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setTutorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  if (error || !moduleData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Module not found'}</p>
          <Link href="/learning" className="text-secondary hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { module, is_completed, quiz_score } = moduleData;

  return (
    <div className="min-h-screen bg-primary-dark">
      {/* Header */}
      <header className="bg-primary border-b border-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/learning" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {is_completed && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Completed {quiz_score && `(${quiz_score}%)`}
              </span>
            )}
            <button
              onClick={() => setShowTutor(!showTutor)}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 text-secondary rounded-lg hover:bg-secondary/30"
            >
              <MessageSquare className="w-4 h-4" />
              Ask Tutor
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Module Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Clock className="w-4 h-4" />
            {module.duration_minutes} minutes
            {module.is_critical && (
              <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                Critical Module - 100% Required
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">{module.title}</h1>
          <p className="text-gray-400">{module.description}</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border">
          <button
            onClick={() => setViewState('content')}
            className={`px-4 py-3 border-b-2 transition-colors ${
              viewState === 'content' 
                ? 'border-secondary text-secondary' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            Content
          </button>
          <button
            onClick={() => setViewState('quiz')}
            className={`px-4 py-3 border-b-2 transition-colors ${
              viewState === 'quiz' || viewState === 'results'
                ? 'border-secondary text-secondary' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 inline mr-2" />
            Quiz
            {is_completed && <CheckCircle className="w-4 h-4 inline ml-2 text-green-400" />}
          </button>
        </div>

        {/* Content View */}
        {viewState === 'content' && (
          <div>
            {module.image_url && (
              <img 
                src={module.image_url} 
                alt={module.title}
                className="w-full rounded-xl mb-8 max-h-80 object-cover"
              />
            )}
            
            <div className="prose prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: formatContent(module.content) }} />
            </div>

            {module.external_links && module.external_links.length > 0 && (
              <div className="mt-8 p-6 bg-card border border-border rounded-xl">
                <h3 className="font-semibold mb-4">Additional Resources</h3>
                <ul className="space-y-2">
                  {module.external_links.map((link, i) => (
                    <li key={i}>
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-secondary hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setViewState('quiz')}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
              >
                Take Quiz
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Quiz View */}
        {viewState === 'quiz' && (
          <div>
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-2">{module.quiz.title}</h2>
              <p className="text-gray-400 text-sm">
                Answer all questions to complete this module. 
                {module.is_critical ? ' You need 100% to pass.' : ' You need 80% to pass.'}
              </p>
            </div>

            <div className="space-y-6">
              {module.quiz.questions.map((question, qIndex) => (
                <div key={question.id} className="bg-card border border-border rounded-xl p-6">
                  <p className="font-medium mb-4">
                    <span className="text-secondary mr-2">{qIndex + 1}.</span>
                    {question.question}
                  </p>
                  <div className="space-y-3">
                    {question.options.map((option, oIndex) => (
                      <label
                        key={oIndex}
                        className={`quiz-option flex items-center gap-3 ${
                          quizAnswers[question.id] === option ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={quizAnswers[question.id] === option}
                          onChange={() => setQuizAnswers(prev => ({ ...prev, [question.id]: option }))}
                          className="w-4 h-4 accent-secondary"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleQuizSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Results View */}
        {viewState === 'results' && quizResults && (
          <div>
            <div className={`p-8 rounded-xl mb-8 text-center ${
              quizResults.passed 
                ? 'bg-green-500/20 border border-green-500' 
                : 'bg-red-500/20 border border-red-500'
            }`}>
              {quizResults.passed ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Congratulations!</h2>
                  <p className="text-gray-300">You scored {quizResults.score}% and passed this module.</p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Not Quite</h2>
                  <p className="text-gray-300">
                    You scored {quizResults.score}%. You need {quizResults.required_score}% to pass.
                  </p>
                </>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-4">Review Your Answers</h3>
            <div className="space-y-4">
              {quizResults.results.map((result, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-xl border ${
                    result.is_correct 
                      ? 'bg-green-500/10 border-green-500/50' 
                      : 'bg-red-500/10 border-red-500/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.is_correct ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium mb-1">{result.question}</p>
                      <p className="text-sm text-gray-400">Your answer: {result.your_answer}</p>
                      {result.explanation && (
                        <p className="text-sm text-gray-300 mt-2">{result.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-4 justify-center">
              {!quizResults.passed && (
                <button
                  onClick={handleRetakeQuiz}
                  className="flex items-center gap-2 px-6 py-3 border border-secondary text-secondary rounded-lg hover:bg-secondary/10"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake Quiz
                </button>
              )}
              <Link
                href="/learning"
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
              >
                {quizResults.passed ? 'Continue Learning' : 'Back to Dashboard'}
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor Sidebar */}
      {showTutor && (
        <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-secondary" />
              AI Tutor
            </h3>
            <button onClick={() => setShowTutor(false)} className="text-gray-400 hover:text-white text-xl">×</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tutorChat.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                Ask me anything about this module! I'm here to help you understand the material.
              </p>
            )}
            {tutorChat.map((msg, i) => (
              <div key={i} className={`p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-secondary/20 ml-8' 
                  : 'bg-primary-light/30 mr-8'
              }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
            {tutorLoading && (
              <div className="bg-primary-light/30 mr-8 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Thinking...</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={tutorMessage}
                onChange={(e) => setTutorMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTutorSend()}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
              />
              <button
                onClick={handleTutorSend}
                disabled={tutorLoading || !tutorMessage.trim()}
                className="px-4 py-2 bg-secondary text-primary-dark rounded-lg disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format markdown-like content to HTML
function formatContent(content: string): string {
  let formatted = content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>');
  
  // Wrap consecutive list items in ul
  formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');
  
  return formatted;
}
