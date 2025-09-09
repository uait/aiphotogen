'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Download, Eye, Shield, Brain, Clock, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { MemoryManagementService } from '@/lib/services/MemoryManagementService';
import { MemorySettings, MemoryUsageStats, MemorySearchResult } from '@/lib/types/memory';

interface MemoryManagementPanelProps {
  onClose?: () => void;
}

export function MemoryManagementPanel({ onClose }: MemoryManagementPanelProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [stats, setStats] = useState<MemoryUsageStats | null>(null);
  const [searchResults, setSearchResults] = useState<MemorySearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  const memoryService = MemoryManagementService.getInstance();

  useEffect(() => {
    loadMemoryData();
  }, [user]);

  const loadMemoryData = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    try {
      const [userSettings, userStats] = await Promise.all([
        memoryService.getMemorySettings(user.uid),
        memoryService.getMemoryUsageStats(user.uid)
      ]);
      
      setSettings(userSettings);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading memory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsUpdate = async (updates: Partial<MemorySettings>) => {
    if (!settings || !user?.uid) return;
    
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...updates };
      await memoryService.updateMemorySettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchMemories = async () => {
    if (!user?.uid || !searchQuery.trim()) return;
    
    try {
      const results = await memoryService.searchAllMemories(user.uid, searchQuery, {
        includeSemantic: true,
        includeEpisodic: true,
        limit: 20
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching memories:', error);
    }
  };

  const handleClearAllMemories = async () => {
    if (!user?.uid) return;
    
    try {
      await memoryService.clearAllUserMemories(user.uid);
      await loadMemoryData();
      setShowConfirmClear(false);
      setSearchResults(null);
    } catch (error) {
      console.error('Error clearing memories:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEffectivenessColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEffectivenessLabel = (score: number): string => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Poor';
  };

  if (loading || !settings || !stats) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Memory Management
          </h2>
          <p className="text-muted-foreground">Control your AI assistant's memory and learning</p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="search">
            <Eye className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Memory Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Memories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.totalMemories.semantic + stats.totalMemories.episodic}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.totalMemories.semantic} semantic, {stats.totalMemories.episodic} episodic
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(stats.storageUsed.total)}</div>
                <div className="text-xs text-muted-foreground">
                  Including embeddings and metadata
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getEffectivenessColor(stats.memoryEffectivenessScore)}`}>
                  {getEffectivenessLabel(stats.memoryEffectivenessScore)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(stats.memoryEffectivenessScore * 100).toFixed(0)}% efficiency score
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Memory Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Memory Distribution</CardTitle>
              <CardDescription>How your memories are categorized</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topCategories.map((category) => (
                  <div key={category.category} className="flex items-center justify-between">
                    <span className="capitalize">{category.category}</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={(category.count / Math.max(...stats.topCategories.map(c => c.count))) * 100} 
                        className="w-24 h-2"
                      />
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {category.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>This Month's Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.monthlyActivity.memoriesCreated}
                  </div>
                  <div className="text-sm text-muted-foreground">Memories Created</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.monthlyActivity.memoriesAccessed}
                  </div>
                  <div className="text-sm text-muted-foreground">Memories Accessed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.monthlyActivity.conversationsWithMemory}
                  </div>
                  <div className="text-sm text-muted-foreground">Conversations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.averageContextRetrievalTime}ms
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Retrieval</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* Memory Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Memory Controls</CardTitle>
              <CardDescription>Configure how your AI assistant remembers and learns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Enable Memory</label>
                  <p className="text-sm text-muted-foreground">Allow AI to remember our conversations</p>
                </div>
                <Switch
                  checked={settings.memoryEnabled}
                  onCheckedChange={(checked) => handleSettingsUpdate({ memoryEnabled: checked })}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Short-term Memory</label>
                  <p className="text-sm text-muted-foreground">Remember recent conversation context</p>
                </div>
                <Switch
                  checked={settings.shortTermMemoryEnabled}
                  onCheckedChange={(checked) => handleSettingsUpdate({ shortTermMemoryEnabled: checked })}
                  disabled={saving || !settings.memoryEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Long-term Learning</label>
                  <p className="text-sm text-muted-foreground">Learn your preferences and patterns</p>
                </div>
                <Switch
                  checked={settings.semanticMemoryEnabled}
                  onCheckedChange={(checked) => handleSettingsUpdate({ semanticMemoryEnabled: checked })}
                  disabled={saving || !settings.memoryEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Episode Memories</label>
                  <p className="text-sm text-muted-foreground">Remember significant conversations</p>
                </div>
                <Switch
                  checked={settings.episodicMemoryEnabled}
                  onCheckedChange={(checked) => handleSettingsUpdate({ episodicMemoryEnabled: checked })}
                  disabled={saving || !settings.memoryEnabled}
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium">Memory Importance Threshold</label>
                <p className="text-sm text-muted-foreground">
                  How important information needs to be to remember (0.1 = everything, 0.9 = only very important)
                </p>
                <Slider
                  value={[settings.memoryImportanceThreshold]}
                  onValueChange={([value]) => handleSettingsUpdate({ memoryImportanceThreshold: value })}
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  disabled={saving || !settings.memoryEnabled}
                  className="py-4"
                />
                <div className="text-sm text-muted-foreground">
                  Current: {settings.memoryImportanceThreshold}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Cross-conversation Memory</label>
                  <p className="text-sm text-muted-foreground">Use memories from other conversations</p>
                </div>
                <Switch
                  checked={settings.allowCrossConversationMemory}
                  onCheckedChange={(checked) => handleSettingsUpdate({ allowCrossConversationMemory: checked })}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Adaptive Model Selection</label>
                  <p className="text-sm text-muted-foreground">Let AI choose optimal models based on context</p>
                </div>
                <Switch
                  checked={settings.adaptiveModelSelection}
                  onCheckedChange={(checked) => handleSettingsUpdate({ adaptiveModelSelection: checked })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium">Preferred Model Provider</label>
                <Select
                  value={settings.preferredModelProvider}
                  onValueChange={(value) => handleSettingsUpdate({ preferredModelProvider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Recommended)</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Memories</CardTitle>
              <CardDescription>Find specific information from your conversation history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search your memories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMemories()}
                  className="flex-1 px-3 py-2 border border-input rounded-md"
                />
                <Button onClick={handleSearchMemories} disabled={!searchQuery.trim()}>
                  Search
                </Button>
              </div>

              {searchResults && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Found {searchResults.totalCount} results in {searchResults.searchTimeMs}ms
                  </div>

                  {/* Semantic Memories */}
                  {searchResults.memories.semantic.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Learned Preferences</h3>
                      {searchResults.memories.semantic.map((memory) => (
                        <Card key={memory.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm">{memory.content.substring(0, 200)}...</p>
                              <div className="flex gap-1 mt-2">
                                {memory.keywords.slice(0, 3).map((keyword) => (
                                  <Badge key={keyword} variant="secondary" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground ml-4">
                              {memory.category}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Episodic Memories */}
                  {searchResults.memories.episodic.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Conversation Episodes</h3>
                      {searchResults.memories.episodic.map((memory) => (
                        <Card key={memory.id} className="p-3">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">{memory.summary}</p>
                            <div className="flex gap-1">
                              {memory.keyTopics.slice(0, 4).map((topic) => (
                                <Badge key={topic} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {memory.createdAt.toLocaleDateString()}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {searchResults.totalCount === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No memories found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          {/* Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
              <CardDescription>Control how long your data is stored</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="font-medium">Data Retention Period</label>
                <Select
                  value={settings.dataRetentionDays.toString()}
                  onValueChange={(value) => handleSettingsUpdate({ dataRetentionDays: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Keep Forever</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="365">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  {settings.dataRetentionDays === 0
                    ? "Your memories will be kept indefinitely until manually deleted."
                    : `Your memories will be automatically deleted after ${settings.dataRetentionDays} days.`
                  }
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Download your memory data</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export All Memories
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showConfirmClear ? (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowConfirmClear(true)}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Memories
                </Button>
              ) : (
                <div className="space-y-3">
                  <Alert className="border-red-200">
                    <AlertDescription className="text-red-600">
                      This will permanently delete all your memories, conversations, and learned preferences. 
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleClearAllMemories}
                      className="flex-1"
                    >
                      Yes, Delete Everything
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowConfirmClear(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}