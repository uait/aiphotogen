'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Download, Eye, Shield, Brain, Clock, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface MemoryManagementPanelProps {
  onClose?: () => void;
}

interface MemoryStats {
  totalMemories: number;
  storageMB: number;
  effectivenessPercent: number;
  monthlyActivity: {
    created: number;
    retrieved: number;
    summarized: number;
  };
}

interface MemorySearchResult {
  id: string;
  type: 'semantic' | 'episodic';
  content: string;
  createdAt: string;
  score: number;
}

export function MemoryManagementPanel({ onClose }: MemoryManagementPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [shortTermEnabled, setShortTermEnabled] = useState(true);
  const [longTermEnabled, setLongTermEnabled] = useState(true);
  const [episodicEnabled, setEpisodicEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Load memory stats on component mount
  useEffect(() => {
    if (user && activeTab === 'overview') {
      loadMemoryStats();
    }
  }, [user, activeTab]);

  // Load memory settings on component mount
  useEffect(() => {
    if (user) {
      loadMemorySettings();
    }
  }, [user]);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    if (!user) throw new Error('User not authenticated');
    
    const token = await user.getIdToken();
    const response = await fetch(`/api/memory/${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'API request failed');
    }

    return response.json();
  };

  const loadMemoryStats = async () => {
    try {
      setLoading(true);
      const data = await apiCall('stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to load memory stats:', error);
      toast.error('Failed to load memory statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadMemorySettings = async () => {
    try {
      // Settings are loaded from the toggle API when we call it
      // For now, we'll use defaults and they'll be updated when user interacts
    } catch (error) {
      console.error('Failed to load memory settings:', error);
    }
  };

  const handleToggleMemory = async (type: string, value: boolean) => {
    try {
      const requestBody: any = {};
      
      switch (type) {
        case 'memory':
          requestBody.master = value;
          setMemoryEnabled(value);
          break;
        case 'shortTerm':
          requestBody.shortTerm = value;
          setShortTermEnabled(value);
          break;
        case 'longTerm':
          requestBody.longTerm = value;
          setLongTermEnabled(value);
          break;
        case 'episodic':
          requestBody.episodic = value;
          setEpisodicEnabled(value);
          break;
      }

      const response = await apiCall('toggle', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      // Update all states from server response
      setMemoryEnabled(response.memoryEnabled);
      setShortTermEnabled(response.shortTermMemoryEnabled);
      setLongTermEnabled(response.semanticMemoryEnabled);
      setEpisodicEnabled(response.episodicMemoryEnabled);

      const typeLabels: Record<string, string> = {
        memory: 'Memory',
        shortTerm: 'Short-term memory',
        longTerm: 'Long-term learning',
        episodic: 'Episode memories'
      };

      toast.success(`${typeLabels[type]} ${value ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('Failed to update memory setting:', error);
      toast.error('Failed to update memory setting');
      // Revert the optimistic update
      switch (type) {
        case 'memory':
          setMemoryEnabled(!value);
          break;
        case 'shortTerm':
          setShortTermEnabled(!value);
          break;
        case 'longTerm':
          setLongTermEnabled(!value);
          break;
        case 'episodic':
          setEpisodicEnabled(!value);
          break;
      }
    }
  };

  const handleClearMemories = async () => {
    if (showConfirmClear) {
      try {
        setLoading(true);
        const response = await apiCall('clear', {
          method: 'DELETE',
          body: JSON.stringify({ confirmToken: 'CONFIRM_DELETE_ALL_MEMORIES' }),
        });

        toast.success(`Successfully cleared ${response.clearedCount} memories`);
        setShowConfirmClear(false);
        
        // Refresh stats
        if (activeTab === 'overview') {
          await loadMemoryStats();
        }
        
      } catch (error) {
        console.error('Failed to clear memories:', error);
        toast.error('Failed to clear memories');
      } finally {
        setLoading(false);
      }
    } else {
      setShowConfirmClear(true);
    }
  };

  const handleExportMemories = async () => {
    try {
      setLoading(true);
      const response = await apiCall('export', {
        method: 'POST',
      });

      // Create and download file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Memory export downloaded successfully');
      
    } catch (error) {
      console.error('Failed to export memories:', error);
      toast.error('Failed to export memories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      const response = await apiCall(`search?q=${encodeURIComponent(searchQuery)}&limit=10`);
      setSearchResults(response.results || []);
      
      if (response.results.length === 0) {
        toast.info('No memories found matching your search');
      }
      
    } catch (error) {
      console.error('Failed to search memories:', error);
      toast.error('Failed to search memories');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        activeTab === id
          ? 'bg-gradient-to-r from-[#00D4FF] to-[#7C3AED] text-white'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const ToggleSwitch = ({ enabled, onChange, disabled = false }: { enabled: boolean; onChange: (value: boolean) => void; disabled?: boolean }) => (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-[#00D4FF]' : 'bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory Management
          </h2>
          <p className="text-gray-400 text-sm">Control your AI assistant's memory and learning</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton id="overview" label="Overview" icon={BarChart3} />
        <TabButton id="settings" label="Settings" icon={Settings} />
        <TabButton id="search" label="Search" icon={Eye} />
        <TabButton id="privacy" label="Privacy" icon={Shield} />
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Memory Statistics</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Total Memories</div>
                    <div className="text-2xl font-bold text-white">{stats?.totalMemories || 0}</div>
                    <div className="text-xs text-gray-400">Long-term & episodes</div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Storage Used</div>
                    <div className="text-2xl font-bold text-white">{stats?.storageMB.toFixed(1) || '0.0'} MB</div>
                    <div className="text-xs text-gray-400">Including embeddings</div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Effectiveness</div>
                    <div className="text-2xl font-bold text-[#00D4FF]">
                      {stats?.effectivenessPercent >= 80 ? 'Excellent' : 
                       stats?.effectivenessPercent >= 60 ? 'Good' : 
                       stats?.effectivenessPercent >= 40 ? 'Fair' : 'Needs Improvement'}
                    </div>
                    <div className="text-xs text-gray-400">{stats?.effectivenessPercent || 0}% efficiency score</div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-white font-medium mb-3">This Month's Activity</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-400">{stats?.monthlyActivity.created || 0}</div>
                      <div className="text-xs text-gray-400">Memories Created</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">{stats?.monthlyActivity.retrieved || 0}</div>
                      <div className="text-xs text-gray-400">Memories Accessed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-400">{stats?.monthlyActivity.summarized || 0}</div>
                      <div className="text-xs text-gray-400">Episodes Summarized</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Memory Controls</h3>
            
            {/* Memory Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Enable Memory</div>
                  <div className="text-sm text-gray-400">Allow AI to remember our conversations</div>
                </div>
                <ToggleSwitch
                  enabled={memoryEnabled}
                  onChange={(value) => handleToggleMemory('memory', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Short-term Memory</div>
                  <div className="text-sm text-gray-400">Remember recent conversation context</div>
                </div>
                <ToggleSwitch
                  enabled={shortTermEnabled}
                  onChange={(value) => handleToggleMemory('shortTerm', value)}
                  disabled={!memoryEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Long-term Learning</div>
                  <div className="text-sm text-gray-400">Learn your preferences and patterns</div>
                </div>
                <ToggleSwitch
                  enabled={longTermEnabled}
                  onChange={(value) => handleToggleMemory('longTerm', value)}
                  disabled={!memoryEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Episode Memories</div>
                  <div className="text-sm text-gray-400">Remember significant conversations</div>
                </div>
                <ToggleSwitch
                  enabled={episodicEnabled}
                  onChange={(value) => handleToggleMemory('episodic', value)}
                  disabled={!memoryEnabled}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Search Memories</h3>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search your memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#00D4FF] focus:outline-none"
                />
                <button 
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 py-2 bg-[#00D4FF] text-white rounded-lg hover:bg-[#00B8E6] transition-colors disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchQuery && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-2">Search results for "{searchQuery}"</div>
                  {searching ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin w-4 h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full"></div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <div key={result.id} className="bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[#00D4FF] font-medium uppercase">
                              {result.type === 'semantic' ? 'Known Fact' : 'Episode Summary'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(result.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-gray-300 text-sm">
                            {result.content.length > 200 
                              ? `${result.content.substring(0, 200)}...` 
                              : result.content
                            }
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
                            Relevance: {Math.round(result.score * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-300">No memories found matching your search.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Privacy Controls</h3>
            
            {/* Data Export */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-white mb-2">Data Export</h4>
                <button
                  onClick={handleExportMemories}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Download size={16} />
                  Export All Memories
                </button>
              </div>

              {/* Danger Zone */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="font-medium text-red-400 mb-2">Danger Zone</h4>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  {!showConfirmClear ? (
                    <div>
                      <p className="text-red-300 text-sm mb-3">
                        This will permanently delete all your memories and learned preferences.
                      </p>
                      <button
                        onClick={handleClearMemories}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                        Clear All Memories
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-300 text-sm mb-3">
                        Are you sure? This action cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleClearMemories}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Yes, Delete Everything
                        </button>
                        <button
                          onClick={() => setShowConfirmClear(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}