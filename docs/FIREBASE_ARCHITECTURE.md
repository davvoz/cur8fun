# Firebase Architecture - cur8fun

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  (CreatePostView, DraftsView, etc.)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CreatePostService                              │
│  • saveDraftWithId()                                            │
│  • getDraftById()                                               │
│  • deleteDraftById()                                            │
│  • getAllUserDrafts()                                           │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│   FirebaseService        │    │      localStorage              │
│   (services/             │    │      (Browser API)             │
│    FirebaseService.js)   │    │                                │
└──────────┬───────────────┘    └────────────────────────────────┘
           │
           │ Initialize, Save, Load, Delete
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Firebase SDK (CDN)                             │
│   https://www.gstatic.com/firebasejs/10.7.1/                    │
│   • firebase-app.js                                              │
│   • firebase-firestore.js                                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Firebase Cloud (Google)                          │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Firestore Database                                        │  │
│  │                                                            │  │
│  │  ┌─────────────────┐    ┌──────────────────────┐        │  │
│  │  │ drafts          │    │ scheduled_posts      │        │  │
│  │  │                 │    │                      │        │  │
│  │  │ • user1_draft1  │    │ • user1_post1       │        │  │
│  │  │ • user1_draft2  │    │ • user2_post1       │        │  │
│  │  │ • user2_draft1  │    │ • user3_post1       │        │  │
│  │  └─────────────────┘    └──────────────────────┘        │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Save Draft Flow

```
User Action (Save Draft)
         │
         ▼
CreatePostService.saveDraftWithId()
         │
         ├─────────────┬─────────────┐
         │             │             │
         ▼             ▼             ▼
   Validate      Generate ID    Cleanup Old
         │             │             │
         └──────┬──────┴─────────────┘
                │
                ▼
         Prepare Draft Data
                │
                ├──────────────┬──────────────┐
                │              │              │
                ▼              ▼              ▼
    Try Firebase      Save to        Success?
    Service       localStorage       │
                      (backup)       │
                         │           │
                         │           ▼
                         │      Return Result
                         │     {success: true,
                         │      savedToFirebase: true}
                         │
                         └──────────────────────┐
                                                │
                                                ▼
                                         (Fallback if
                                         Firebase fails)
```

### Load Draft Flow

```
User Action (Load Draft)
         │
         ▼
CreatePostService.getDraftById(id)
         │
         ▼
   Try Firebase First
         │
         ├─────────┬──────────┐
         │         │          │
         ▼         ▼          ▼
    Firebase   Found?    Try localStorage
    Query        │           │
         │       │           │
         └───Yes─┴───No──────┘
                │
                ▼
         Return Draft Data
```

### Delete Draft Flow

```
User Action (Delete Draft)
         │
         ▼
CreatePostService.deleteDraftById(id)
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
   Delete from    Delete from    Return Success
   Firebase       localStorage
   (if enabled)   (always)
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Environment                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Application Layer                      │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌──────────────┐               │    │
│  │  │CreatePost   │  │  DraftsView  │               │    │
│  │  │View         │  │              │               │    │
│  │  └──────┬──────┘  └──────┬───────┘               │    │
│  │         │                 │                        │    │
│  │         └────────┬────────┘                        │    │
│  │                  │                                 │    │
│  └──────────────────┼─────────────────────────────────┘    │
│                     │                                       │
│  ┌──────────────────┼─────────────────────────────────┐    │
│  │                  ▼      Service Layer              │    │
│  │  ┌───────────────────────────────┐                │    │
│  │  │    CreatePostService          │                │    │
│  │  │  • Authentication             │                │    │
│  │  │  • Draft Management           │                │    │
│  │  │  • Post Creation              │                │    │
│  │  └──────────┬────────────────────┘                │    │
│  │             │                                      │    │
│  │             ├───────────┬──────────┐              │    │
│  │             ▼           ▼          ▼              │    │
│  │  ┌─────────────┐ ┌──────────┐ ┌─────────┐       │    │
│  │  │Firebase     │ │AuthService│ │Steem    │       │    │
│  │  │Service      │ │          │ │Service  │       │    │
│  │  └──────┬──────┘ └──────────┘ └─────────┘       │    │
│  │         │                                         │    │
│  └─────────┼─────────────────────────────────────────┘    │
│            │                                               │
│  ┌─────────┼─────────────────────────────────────────┐    │
│  │         ▼          Storage Layer                  │    │
│  │  ┌─────────────┐                                  │    │
│  │  │localStorage │                                  │    │
│  │  │(Browser)    │                                  │    │
│  │  └─────────────┘                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└────────────────────────┬───────────────────────────────────┘
                         │
                         │ HTTPS
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   External Services                       │
│                                                           │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │Firebase Cloud  │  │Steem         │  │ImRidd API   │ │
│  │(Firestore)     │  │Blockchain    │  │             │ │
│  └────────────────┘  └──────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Backend Architecture (Optional)

```
┌──────────────────────────────────────────────────────────┐
│                   Python Flask Backend                    │
│                                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │             app.py (Flask App)                 │     │
│  │  • API Endpoints                               │     │
│  │  • Scheduled Post Management                   │     │
│  │  • Authentication                              │     │
│  └──────────────┬─────────────────────────────────┘     │
│                 │                                         │
│                 ├───────────┬──────────┬─────────────┐   │
│                 ▼           ▼          ▼             ▼   │
│  ┌──────────────────┐  ┌─────────┐ ┌──────────┐ ┌────┐ │
│  │firebase_service  │  │models.py│ │publisher │ │... │ │
│  │.py (Optional)    │  │(SQLite) │ │.py       │ └────┘ │
│  │                  │  │         │ │          │         │
│  │• Admin SDK       │  │Schedule │ │Auto-post │         │
│  │• Sync to         │  │dPost    │ │Scheduler │         │
│  │  Firestore       │  │Model    │ │          │         │
│  └────────┬─────────┘  └────┬────┘ └────┬─────┘         │
│           │                 │           │               │
└───────────┼─────────────────┼───────────┼───────────────┘
            │                 │           │
            ▼                 ▼           ▼
┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐
│Firebase Cloud    │  │SQLite DB     │  │Steem Blockchain │
│(Admin SDK)       │  │(Local)       │  │                 │
└──────────────────┘  └──────────────┘  └─────────────────┘
```

## Configuration Flow

```
Application Start
       │
       ▼
Initialize Services
       │
       ├──────────────┬─────────────┐
       ▼              ▼             ▼
CreatePost     AuthService    FirebaseService
Service            │               │
       │           │               │
       └───────────┴───────────────┘
                   │
                   ▼
         Initialize Firebase
                   │
                   ▼
    Load firebase-config.js
                   │
                   ├───────────┬────────────┐
                   ▼           ▼            ▼
            Valid Config?   Placeholder   Invalid
                   │            │            │
                   │            │            │
              Yes──┘            └──No        └──Error
                   │                │            │
                   ▼                ▼            ▼
          Load Firebase SDK   Use localStorage  Log Error
                   │            (Fallback)       Use Fallback
                   ▼
          Initialize Firestore
                   │
                   ▼
          Service Ready
                   │
                   ▼
          isFirebaseEnabled = true
```

## Storage Decision Tree

```
User Saves Data
       │
       ▼
  Is Firebase
  Initialized?
       │
       ├────Yes────┐
       │           │
       No          ▼
       │      Try Firebase
       │      Save
       │           │
       │           ├────Success────┐
       │           │               │
       │      Failure              │
       │           │               │
       └───────────┴───────────────┘
                   │
                   ▼
          Save to localStorage
          (Always happens)
                   │
                   ▼
          Return Result
          {success: true,
           savedToFirebase: true/false}
```

## Error Handling Flow

```
Operation (Save/Load/Delete)
           │
           ▼
      Try Firebase
           │
           ├────────┬────────┐
           │        │        │
       Success   Error   Timeout
           │        │        │
           │        └────┬───┘
           │             │
           │             ▼
           │      Log Warning
           │             │
           │             ▼
           │      Try localStorage
           │             │
           └─────────────┘
                   │
                   ▼
           Return Result
           (Always succeeds
            via fallback)
```

## Multi-User Data Isolation

```
Firebase Firestore
       │
       ▼
┌────────────────────────────────────────┐
│  drafts Collection                     │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ user1_draft_1234567890       │     │
│  │  username: "user1"           │     │
│  │  title: "..."                │     │
│  └──────────────────────────────┘     │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ user1_draft_0987654321       │     │
│  │  username: "user1"           │     │
│  │  title: "..."                │     │
│  └──────────────────────────────┘     │
│                                        │
│  ┌──────────────────────────────┐     │
│  │ user2_draft_1111111111       │     │
│  │  username: "user2"           │     │
│  │  title: "..."                │     │
│  └──────────────────────────────┘     │
│                                        │
└────────────────────────────────────────┘

Query: where('username', '==', 'user1')
Returns: Only user1's drafts

Security Rule:
  allow read: if resource.data.username == request.auth.token.username
```

## Sync Strategy

```
┌────────────────────────────────────────────────────┐
│              Hybrid Sync Strategy                   │
│                                                     │
│  User Action → Service                             │
│                  │                                  │
│                  ▼                                  │
│     ┌────────────────────────┐                     │
│     │  Parallel Operations   │                     │
│     │                        │                     │
│     │  ┌──────────────────┐ │                     │
│     │  │ Save to Firebase │ │ (Async, non-block) │
│     │  └────────┬─────────┘ │                     │
│     │           │            │                     │
│     │  ┌────────▼─────────┐ │                     │
│     │  │ Save to          │ │ (Always happens)   │
│     │  │ localStorage     │ │                     │
│     │  └──────────────────┘ │                     │
│     │                        │                     │
│     └────────────────────────┘                     │
│                  │                                  │
│                  ▼                                  │
│     Both operations complete                       │
│     (localStorage always fast)                     │
│                                                     │
└────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
Operation          Firebase    localStorage    Hybrid
─────────────────────────────────────────────────────────
Save Draft         ~200ms      ~5ms           ~205ms*
Load Draft         ~150ms      ~2ms           ~2-150ms**
Delete Draft       ~100ms      ~1ms           ~101ms*
List All Drafts    ~300ms      ~10ms          ~10-300ms**

* Both operations run, total time = max(Firebase, localStorage)
** Tries Firebase first, falls back to localStorage
   Best case: localStorage only (Firebase not configured)
   Typical: Firebase returns quickly
   Worst case: Firebase timeout → localStorage fallback
```

## Scalability

```
Number of Users vs Performance

            │
Performance │     Firestore scales horizontally
            │     ┌────────────────────────────────
            │    /
            │   /  localStorage per-user, always fast
            │  /
            │ /
            │/
            └──────────────────────────────────────
                    Number of Users

Key Points:
• localStorage: Per-user storage, no degradation
• Firebase: Scales automatically, shared limits
• Free tier: 50K reads, 20K writes per day
• Paid tier: Unlimited with billing
```

## Data Consistency Model

```
Eventual Consistency with Immediate Local Access

Time →
─────────────────────────────────────────────────────
User1 Device A: Save Draft
                 │
                 ├→ localStorage ✓ (immediate)
                 │
                 └→ Firebase ↓ (200ms)
                           │
                           ✓ Firestore updated
                           
User1 Device B:  Load Draft
                 │
                 ├→ Firebase query (if configured)
                 │   └→ Returns latest ✓
                 │
                 └→ localStorage (fallback)
                     └→ Returns cached ✓

Result: Data available immediately on same device,
        synced across devices via Firebase
```

## Summary

### Key Design Principles

1. **Hybrid Storage**: Both Firebase and localStorage
2. **Graceful Degradation**: Works without Firebase
3. **User Isolation**: Data separated by username
4. **Fast Local Access**: localStorage always available
5. **Cloud Sync**: Firebase when configured
6. **Error Resilience**: Multiple fallback layers
7. **Scalability**: Firebase handles growth
8. **Security**: Per-user access control

### Performance Goals

- ✅ Local operations: < 10ms
- ✅ Firebase operations: < 300ms
- ✅ Fallback time: < 1s (on Firebase timeout)
- ✅ No blocking UI operations
- ✅ Asynchronous where possible

### Reliability

- ✅ localStorage always works (offline)
- ✅ Firebase adds cloud backup (online)
- ✅ Multiple fallback layers
- ✅ No single point of failure
- ✅ Graceful degradation at every level
