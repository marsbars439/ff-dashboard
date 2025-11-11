import React, { useEffect, useState } from 'react';
import { Gavel, Loader2 } from 'lucide-react';

const RuleChangeVoting = ({
  seasonYear,
  proposals = [],
  loading = false,
  error = null,
  onVote,
  userVotes = {},
  voteSubmitting = {},
  canVote = true
}) => {
  const displaySeason = seasonYear != null ? seasonYear + 1 : null;
  const [activeIndex, setActiveIndex] = useState(0);

  const totalProposals = Array.isArray(proposals) ? proposals.length : 0;
  useEffect(() => {
    setActiveIndex(prevIndex => {
      if (totalProposals === 0) {
        return 0;
      }
      return Math.min(prevIndex, totalProposals - 1);
    });
  }, [totalProposals]);
  const clampedIndex = totalProposals > 0 ? Math.min(Math.max(activeIndex, 0), totalProposals - 1) : 0;
  const activeProposal = totalProposals > 0 ? proposals[clampedIndex] : null;
  const hasPrevious = clampedIndex > 0;
  const hasNext = clampedIndex < totalProposals - 1;
  const currentQuestion = activeProposal ? clampedIndex + 1 : 0;
  const totalVotes = activeProposal
    ? activeProposal.options.reduce((sum, option) => sum + (option.votes || 0), 0)
    : 0;
  const selectedOption = activeProposal
    ? (userVotes && userVotes[activeProposal.id]) ?? activeProposal.userVote ?? null
    : null;
  const isSubmitting = activeProposal ? !!voteSubmitting[activeProposal.id] : false;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center space-x-2">
            <Gavel className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {displaySeason ? `Potential Rule Changes for the ${displaySeason} Season` : 'Potential Rule Changes'}
            </h2>
          </div>
          {totalProposals > 0 && (
            <p className="text-sm text-gray-500 sm:ml-7">
              Question {currentQuestion} of {totalProposals}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!canVote && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          Verify your manager identity above to participate in voting.
        </div>
      )}

      {loading ? (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading rule change proposals...</span>
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
          No rule change proposals yet. Check back soon!
        </div>
      ) : (
        <div className="space-y-6">
          {activeProposal && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activeProposal.title}</h3>
                  {activeProposal.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {activeProposal.description}
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {totalVotes} vote{totalVotes === 1 ? '' : 's'}
                </div>
              </div>

              <div className="space-y-3">
                {activeProposal.options.map(option => {
                  const votes = option.votes || 0;
                  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const isSelected = selectedOption === option.value;

                  return (
                    <div key={`${activeProposal.id}-${option.value}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{option.value}</p>
                          <p className="text-xs text-gray-500">
                            {votes} vote{votes === 1 ? '' : 's'}{totalVotes > 0 ? ` • ${percentage}%` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onVote && onVote(activeProposal.id, option.value)}
                          disabled={
                            isSubmitting ||
                            !onVote ||
                            !canVote ||
                            (isSelected && !isSubmitting)
                          }
                          className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
                          } ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                        >
                          {isSelected ? 'Voted' : 'Vote'}
                        </button>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: totalVotes > 0 ? `${percentage}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedOption && (
                <p className="mt-3 text-xs text-green-600">
                  You voted for <span className="font-semibold">{selectedOption}</span>.
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasPrevious) {
                      return;
                    }
                    setActiveIndex(index => Math.max(index - 1, 0));
                  }}
                  disabled={!hasPrevious}
                  className="px-3 py-1 text-xs sm:text-sm font-medium rounded-md border border-gray-300 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasNext) {
                      return;
                    }
                    setActiveIndex(index => Math.min(index + 1, totalProposals - 1));
                  }}
                  disabled={!hasNext}
                  className="px-3 py-1 text-xs sm:text-sm font-medium rounded-md border border-gray-300 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleChangeVoting;
