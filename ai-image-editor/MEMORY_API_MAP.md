# Memory Management API Map

## 🗺️ Complete API Reference for Memory Management UI

This document maps all Memory Management UI functionality to their corresponding backend APIs.

## 📊 Overview Tab APIs

### Memory Statistics Display
**Frontend Component**: Memory Statistics Grid  
**API Endpoint**: `GET /api/memory/stats`  
**Triggers**: Component mount, tab switch to Overview

**Request**:
```http
GET /api/memory/stats
Authorization: Bearer <firebase-jwt-token>
```

**Response Mapping**:
```javascript
// Frontend State Updates
stats.totalMemories → "Total Memories" card value
stats.storageMB → "Storage Used" card value  
stats.effectivenessPercent → "Effectiveness" rating and percentage
stats.monthlyActivity.created → "Memories Created" metric
stats.monthlyActivity.retrieved → "Memories Accessed" metric  
stats.monthlyActivity.summarized → "Episodes Summarized" metric
```

**UI Components**:
- Loading spinner during API call
- Error handling with retry button
- Real-time effectiveness scoring
- Storage usage visualization

## ⚙️ Settings Tab APIs

### Memory Toggle Controls
**Frontend Component**: Toggle Switches  
**API Endpoint**: `POST /api/memory/toggle`  
**Triggers**: User clicks any toggle switch

**Request Flow**:
```javascript
// User toggles "Memory" switch
handleToggleMemory('memory', true) → {
  requestBody: { master: true },
  endpoint: 'POST /api/memory/toggle'
}

// User toggles "Short-term Memory" switch  
handleToggleMemory('shortTerm', false) → {
  requestBody: { shortTerm: false },
  endpoint: 'POST /api/memory/toggle'
}

// User toggles "Long-term Learning" switch
handleToggleMemory('longTerm', true) → {
  requestBody: { longTerm: true },
  endpoint: 'POST /api/memory/toggle'
}

// User toggles "Episode Memories" switch
handleToggleMemory('episodic', false) → {
  requestBody: { episodic: false },
  endpoint: 'POST /api/memory/toggle'
}
```

**Response Handling**:
```javascript
// Server response updates ALL toggle states
response = {
  memoryEnabled: true,
  shortTermMemoryEnabled: true, 
  semanticMemoryEnabled: false,
  episodicMemoryEnabled: true
}

// Frontend updates ALL state variables
setMemoryEnabled(response.memoryEnabled)
setShortTermEnabled(response.shortTermMemoryEnabled)
setLongTermEnabled(response.semanticMemoryEnabled)  
setEpisodicEnabled(response.episodicMemoryEnabled)
```

**Error Handling**:
- Optimistic updates with rollback on failure
- Toast notifications for success/error
- Disabled toggle states when master memory is off

## 🔍 Search Tab APIs

### Memory Search Functionality
**Frontend Component**: Search Input + Results Display  
**API Endpoint**: `GET /api/memory/search`  
**Triggers**: User clicks "Search" button

**Search Flow**:
```javascript
// User enters query and clicks search
searchQuery = "dark mode preferences"
handleSearch() → {
  endpoint: `GET /api/memory/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
  state: setSearching(true)
}
```

**Response Processing**:
```javascript
response = {
  results: [
    {
      id: "mem_123", 
      type: "semantic",
      content: "User prefers dark mode interface with blue accents",
      createdAt: "2025-01-09T10:30:00Z",
      score: 0.87
    }
  ],
  totalCount: 5,
  query: "dark mode preferences",
  type: "all"
}

// Frontend renders results
setSearchResults(response.results)
```

**UI Features**:
- Real-time search with loading states
- Result cards with type badges (Known Fact/Episode Summary)
- Relevance scoring display
- Content truncation for long memories
- Empty state for no results

## 🔐 Privacy Tab APIs  

### Data Export Functionality
**Frontend Component**: "Export All Memories" Button  
**API Endpoint**: `POST /api/memory/export`  
**Triggers**: User clicks export button

**Export Flow**:
```javascript
handleExportMemories() → {
  endpoint: 'POST /api/memory/export',
  processing: setLoading(true)
}

// Response handling
response = {
  success: true,
  downloadFilename: "pixtorai-memories-user123-2025-01-09.json",
  data: { /* complete memory export */ }
}

// Frontend creates downloadable file
const blob = new Blob([JSON.stringify(response.data, null, 2)], {
  type: 'application/json'
})
// Triggers browser download
```

### Memory Clear Functionality  
**Frontend Component**: "Clear All Memories" Danger Zone  
**API Endpoint**: `DELETE /api/memory/clear`  
**Triggers**: User confirms memory deletion

**Clear Flow**:
```javascript
// First click - show confirmation
handleClearMemories() → showConfirmClear = true

// Second click - actual deletion
handleClearMemories() → {
  endpoint: 'DELETE /api/memory/clear',
  body: { confirmToken: 'CONFIRM_DELETE_ALL_MEMORIES' },
  processing: setLoading(true)
}

// Success response
response = {
  success: true,
  clearedCount: 247, 
  message: "All memories have been permanently deleted"
}

// Frontend updates
toast.success(`Successfully cleared ${response.clearedCount} memories`)
loadMemoryStats() // Refresh overview stats
showConfirmClear = false
```

**Security Features**:
- Two-step confirmation process
- Required confirmation token
- Immediate stats refresh after deletion
- Success/failure toast notifications

## 🔄 Context Generation API

### Background Memory Context Building
**Frontend Component**: N/A (Used by AI generation)  
**API Endpoint**: `POST /api/memory/context`  
**Triggers**: Every AI model request

**Internal Usage**:
```javascript
// Called automatically during AI generation
buildMemoryContext(userId, conversationId, prompt) → {
  endpoint: 'POST /api/memory/context',
  body: {
    conversationId: 'conv_123',
    currentPrompt: 'What were we discussing about the API?',
    maxTokens: 8000
  }
}

// Response used for model input
response = {
  context: "SYSTEM: You are Pixtorai...\n\nKNOWN FACTS:\n- User prefers REST APIs...",
  tokenCount: 1847,
  remainingTokens: 6153,
  components: {
    systemPrompt: true,
    shortTerm: true, 
    semantic: 3,
    episodic: 1
  }
}
```

## 🛡️ Authentication & Error Handling

### Authentication Flow
All memory APIs require Firebase JWT authentication:

```javascript
const apiCall = async (endpoint, options = {}) => {
  const token = await user.getIdToken()
  const response = await fetch(`/api/memory/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error('API request failed')
  }
  
  return response.json()
}
```

### Error Handling Patterns

**Network Errors**:
```javascript
try {
  const response = await apiCall('stats')
  // Handle success
} catch (error) {
  console.error('Failed to load memory stats:', error)
  toast.error('Failed to load memory statistics')
}
```

**Authentication Errors**:
```javascript
if (response.status === 401) {
  toast.error('Please sign in to access memory features')
  // Redirect to authentication
}
```

**Validation Errors**:
```javascript
if (response.status === 400) {
  const error = await response.json()
  toast.error(error.message || 'Invalid request')
}
```

## 📱 Mobile Responsiveness

### UI Adaptations
- Grid layouts collapse to single column on mobile
- Touch-friendly button sizes (minimum 44px)
- Swipe-friendly tab navigation
- Responsive text sizing
- Modal behavior on small screens

### API Considerations
- Same endpoints work across all devices
- Response payloads optimized for bandwidth
- Progressive loading for large datasets
- Caching for offline scenarios

## 🔧 Development Testing

### API Testing Commands
```bash
# Test authentication
curl -H "Authorization: Bearer <token>" https://pixtorai.com/api/memory/stats

# Test memory search
curl -H "Authorization: Bearer <token>" \
  "https://pixtorai.com/api/memory/search?q=preferences&limit=5"

# Test memory toggle
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"master":true}' \
  https://pixtorai.com/api/memory/toggle

# Test memory export
curl -X POST -H "Authorization: Bearer <token>" \
  https://pixtorai.com/api/memory/export

# Test memory clear (dangerous!)
curl -X DELETE -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"confirmToken":"CONFIRM_DELETE_ALL_MEMORIES"}' \
  https://pixtorai.com/api/memory/clear
```

## 📈 Performance Monitoring

### Frontend Metrics
- API response times
- UI loading states duration
- Error rates per endpoint
- User interaction patterns

### Backend Metrics  
- Memory retrieval performance
- Context generation time
- Storage usage growth
- Authentication success rates

---

**Last Updated**: 2025-01-09  
**API Version**: 1.0.0  
**Status**: Production Ready