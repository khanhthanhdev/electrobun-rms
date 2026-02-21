# Robot Inspection Feature Documentation

## Overview

The **Robot Inspection** feature is a comprehensive system for managing event robot inspections. It allows inspectors to systematically verify robot compliance using a structured checklist, track progress, manage inspection statuses, and maintain audit trails. The system supports multiple checklist versions, role-based access control, and provides both internal inspector views and public audience displays.

---

## 1. Status

### Inspection Status States

The inspection feature manages four distinct status states representing the inspection lifecycle:

| Status | Label | Description | Audience Visible |
|--------|-------|-------------|------------------|
| `NOT_STARTED` | Not Started | Inspection not yet initiated | Yes |
| `IN_PROGRESS` | In Progress | Inspection actively being conducted | Yes |
| `INCOMPLETE` | Incomplete | Inspection completed with failures or missing items | Yes |
| `PASSED` | Passed | All required items verified and compliant | Yes |

### Status Transitions

```
NOT_STARTED → IN_PROGRESS → (INCOMPLETE | PASSED)
```

**Rules:**
- Can transition to `PASSED` only if all required checklist items are completed
- Can revert to `INCOMPLETE` for corrections
- Transitions require explicit user action

### Status Codes

Internal mappings to FTC inspection codes:
- `NOT_STARTED` → Code `"0"` 
- `IN_PROGRESS` → Code `"1"`
- `INCOMPLETE` → Code `"2"`
- `PASSED` → Code `"3"`

---

## 2. Workflow

### High-Level Flow

```
Event Creation
        ↓
Create/Manage Checklist Version
        ↓
Inspector Starts Inspection
        ↓
Verify Checklist Items (CHECKBOX | SELECT | NUMBER)
        ↓
Add Comments (if needed)
        ↓
Submit Status (incomplete or passed)
        ↓
View History & Previous Comments
        ↓
Update/Correct as Needed
```

### Detailed Process Steps

#### **Step 1: Inspect Team Selection**
- **Actor:** Inspector (ADMIN, QUEUER, TSO, HEAD_REFEREE)
- **Location:** `/event-control/$eventCode/inspect/`
- **Actions:**
  - View all teams with current inspection status
  - Search by team number or name
  - See progress bars showing status distribution
  - Click team to start/continue inspection

#### **Step 2: Load Inspection Detail**
- **Location:** `/event-control/$eventCode/inspect/$teamNumber`
- **System:**
  - Fetches active checklist version for event
  - Auto-creates inspection record if not exists
  - Loads previous responses
  - Calculates missing required items
  - Retrieves previous comments from other events

#### **Step 3: Complete Checklist Items**
- **Inspector actions:**
  - Answer CHECKBOX items (toggle true/false)
  - Select from SELECT options
  - Enter NUMBER values
  - System validates responses against input type
  - Saves individual item updates (no page reload)
  - UI highlights missing required items (optional)

#### **Step 4: Add Comments**
- **Purpose:** Record findings, issues, or remediation requests
- **Visibility:** Visible to team (asynchronous communication)
- **History:** Stored per event
- **Previous Comments:** Shows comments from earlier events for same team

#### **Step 5: Submit Final Status**
- **Options:** `in_progress` → `incomplete` or `passed`
- **Validation:** Cannot pass with missing required items
- **Side Effect:** Invalidates detail and team list queries (refresh UI)

#### **Step 6: Post-Inspection**
- **Inspector can:**
  - Review previous event comments
  - Correct responses
  - Update comments
  - Transition status again if needed

### Role-Based Access

| Role | Can Inspect | Can Change Status | Notes |
|------|-------------|------------------|-------|
| ADMIN | ✓ | ✓ | Full access |
| QUEUER | ✓ | ✓ | Standard inspector |
| TSO | ✓ | ✓ | Event supervisor |
| HEAD_REFEREE | ✓ | ✓ | Technical authority |
| Other | ✗ | ✗ | Forbidden (403) |

### Public Flow

- **Endpoint:** `/api/events/{eventCode}/inspection/public-status`
- **Audience:** Projector displays, OBS, streaming overlays
- **Data:** Team status + progress counts only (no checklist details)
- **Caching:** 5 seconds stale time for performance
- **No Auth Required**

---

## 3. Type System

### Core Types

#### **InspectionStatus**
```typescript
type InspectionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "INCOMPLETE"
  | "PASSED";
```

#### **InspectionInputType**
```typescript
type InspectionInputType = "CHECKBOX" | "SELECT" | "NUMBER";
```

#### **ChecklistOption**
Single option in a SELECT field:
```typescript
type ChecklistOption = {
  key: string;              // "PHONE", "CONTROL_HUB", etc.
  label: string;            // Display text
  order: number;            // Sort order
  isSentinel?: boolean;     // True for "Not Selected" defaults
};
```

#### **ChecklistItem**
Individual question/requirement:
```typescript
type ChecklistItem = {
  id: string;                                    // UUID
  key: string;                                   // "controller_device_type"
  sectionId: string;                             // Parent section
  ruleCode: string;                              // "CTRL-01"
  label: string;                                 // Question text
  inputType: InspectionInputType;                // How to answer
  required: boolean;                             // Must answer to pass
  options?: ChecklistOption[];                   // For SELECT type
  referenceLink?: string | null;                 // Link to Game Manual
  metadata?: Record<string, unknown>;            // Extra data
};
```

#### **ChecklistSection**
Grouping of related items:
```typescript
type ChecklistSection = {
  id: string;         // "section-control"
  key: string;        // "control"
  label: string;      // "Control"
  order: number;      // Display order
};
```

#### **ChecklistDefinition**
Complete checklist structure (template):
```typescript
type ChecklistDefinition = {
  sections: ChecklistSection[];              // All sections
  items: ChecklistItem[];                    // All items
  metadata: Record<string, unknown>;         // Creation info
};
```

#### **InspectionProgress**
Completion tracking:
```typescript
type InspectionProgress = {
  totalRequired: number;      // Count of required items
  completedRequired: number;  // Required items answered
  missingRequired: number;    // Required items not answered
};
```

#### **InspectionTeamSummary**
Single team in list view:
```typescript
type InspectionTeamSummary = {
  organizationId: string;
  teamNumber: string | null;
  teamName: string | null;
  inspectionId: string | null;
  status: InspectionStatus;
  statusLabel: string;                       // "Passed"
  statusCode: string;                        // "3"
  progress: InspectionProgress;
  comment: string | null;                    // Latest comment
  updatedAt: string | null;                  // ISO timestamp
};
```

#### **InspectionDetailResponse**
Full inspection data for detail page:
```typescript
type InspectionDetailResponse = {
  team: {
    organizationId: string;
    teamName: string | null;
    teamNumber: string | null;
  };
  inspection: {
    id: string;
    status: InspectionStatus;
    statusLabel: string;
    statusCode: string;
    comment: string | null;
    controllerDeviceType: string | null;
    qrScannedAt: string | null;
    startedAt: string | null;
    finalizedAt: string | null;
    updatedAt: string | null;
  };
  checklist: {
    versionId: string;
    version: number;
    definition: ChecklistDefinition;
    responses: Record<string, boolean | number | string | null>;
    progress: InspectionProgress;
    missingRequiredItems: MissingItem[];
  };
  versions: Array<{
    id: string;
    version: number;
    isActive: boolean;
    createdAt: string | null;
  }>;
  previousComments: PreviousComment[];
};
```

#### **MissingItem**
Identifies unfilled required fields:
```typescript
type MissingItem = {
  id: string;
  key: string;
  label: string;
  sectionId?: string;
};
```

#### **PreviousComment**
Historical comment from other events:
```typescript
type PreviousComment = {
  id: string;
  eventId: string;
  eventName: string;
  eventCode: string;
  comment: string;
  createdAt: string | null;
};
```

#### **InspectionTeamsResponse**
List view response:
```typescript
type InspectionTeamsResponse = {
  teams: InspectionTeamSummary[];
  counts: Record<InspectionStatus, number>;  // Status distribution
  statuses: Array<{ 
    status: InspectionStatus; 
    label: string; 
    code: string; 
  }>;
  checklistVersion: { 
    id: string; 
    version: number; 
  };
};
```

#### **PublicInspectionStatusResponse**
Public audience data:
```typescript
type PublicInspectionStatusResponse = {
  teams: PublicInspectionTeamSummary[];     // No details/responses
  counts: Record<InspectionStatus, number>;
  statuses: Array<{ 
    status: InspectionStatus; 
    label: string; 
    code: string; 
  }>;
};
```

---

## 4. Notes

### Design Constraints

1. **Checklist Versioning**
   - Each event has one **active** checklist version
   - Multiple versions can exist simultaneously
   - Previous versions remain accessible for historical reference
   - Version changes apply to new inspections, not retroactively

2. **Response Normalization**
   - All responses stored as `Record<string, boolean | number | string | null>`
   - Responses keyed by `ChecklistItem.id`
   - Type validation happens on input, not storage
   - Null = unanswered

3. **Required Item Handling**
   - "Required" items must have non-null, truthy values to pass
   - For CHECKBOX: must be `true`
   - For SELECT: must be non-empty string (excludes sentinel values like "0")
   - For NUMBER: must be > 0
   - Logic in `isValueTruthyForChecklist()` function

4. **Comment History**
   - Comments only stored if explicitly saved
   - Separate from audit log (which tracks all changes)
   - Previous comments query excludes current event
   - Limited to last 20 comments per team

5. **Audit & Compliance**
   - All status changes logged to `eventTeamInspectionAuditLogs`
   - Response changes tracked with timestamps
   - Actor user ID captured for accountability
   - Reason field for status rejections

### Performance Considerations

1. **Query Optimization**
   - Teams list uses indexed lookups (event + organization)
   - Public status endpoint has 5s stale time
   - Detail view loads only active checklist version
   - Pagination/limits on comment history (20 comments)

2. **Client-Side Caching**
   - TanStack Query with stable query keys
   - Detail query invalidated on any update
   - Teams list auto-refetches every 10s
   - Individual item mutations don't require full refetch

3. **Real-Time Updates**
   - Auto-refresh interval on teams list (10 seconds)
   - Manual refetch available
   - No WebSocket/polling for detail view

### Data Integrity

1. **Status Validation**
   - Server enforces transition rules
   - Cannot pass without completing required items
   - Can request `force` override (ADMIN only)
   - Reason field optional but recommended for rejects

2. **Checklist Immutability**
   - Definition stored as JSON in version record
   - Cannot edit active version (create new one)
   - Items/sections keyed by stable IDs for historical queries

3. **Concurrent Updates**
   - Last-write-wins for response values
   - Status transitions atomic at DB level
   - Comments non-conflicting (append-only)

### API Error Handling

All inspection endpoints return error messages:
```javascript
{ error: "Unable to load inspection detail." }     // Generic
{ error: "Cannot pass while required items..." }   // Validation
{ error: "Forbidden" }                              // Auth
```

---

## 5. Design Patterns

### Architecture Pattern: Repository + Service Layer

```
Controller (Hono Route)
    ↓
Service Layer (inspection-queries, event-inspection)
    ↓
Database Layer (Drizzle ORM)
    ↓
Schema (eventTeamInspections, etc.)
```

**Benefits:**
- Clear separation of concerns
- Reusable query logic
- Testable business rules
- Database-agnostic interfaces

### Checklist Management: Version Control Pattern

**Pattern:** Immutable versions with active flag
```typescript
// Create version
POST /api/events/:eventId/inspection/checklist
  { definition: ChecklistDefinition }

// Activate version
PATCH /api/events/:eventId/inspection/checklist
  { activateVersionId: string }
```

**Benefits:**
- No data loss on checklist updates
- Teams can view version they were inspected with
- Audit trail of checklist evolution

### Response Handling: Normalized Flat Structure

**Pattern:** Single `responses` object instead of nested structure
```typescript
// ✗ Avoid nested structure
{
  sections: [{
    items: [{ value: true }]
  }]
}

// ✓ Use flat keyed structure
{
  responses: {
    "item-control-device-type": "PHONE",
    "item-mechanical-safe-edges": true,
    "item-sizing-within-limits": null
  }
}
```

**Benefits:**
- O(1) lookup for specific item value
- Easier database storage (JSON column)
- Simpler comparison logic for missing items
- Simpler form state management in React

### Input Validation: Pipeline Pattern

**Backend (Valibot):**
```typescript
const itemUpdateSchema = v.object({
  itemId: v.pipe(v.string(), v.minLength(1)),
  value: v.union([v.string(), v.number(), v.boolean(), v.null()]),
});
```

**Frontend (Type Guard):**
```typescript
function isValueTruthyForChecklist(value: boolean | number | string | null): boolean {
  // Coercion logic
}
```

**Benefits:**
- Explicit contract definition
- Reusable validators across endpoints
- Type-safe transformations

### State Management: Query-Driven UI

**Pattern:** React Query + TanStack Router
```typescript
// Single source of truth: server state
const detailQuery = useQuery(inspectionDetailQueryOptions(...));

// Mutations trigger invalidation, not local state updates
const itemMutation = useMutation({
  mutationFn: patchInspectionItems,
  onSuccess: () => queryClient.invalidateQueries(...)
});
```

**Benefits:**
- No local state drift
- Automatic refetch on focus
- Offline detection
- Easy testing (mock fetch)

### Error Boundary: User Feedback Pattern

**Detail View:** Shows `statusError` message
```typescript
const [statusError, setStatusError] = useState<string | null>(null);

if (nextStatus === "passed" && !isComplete) {
  setStatusError("Cannot pass while required checklist items are missing.");
  return;
}
```

**Benefits:**
- User understands why action failed
- Prevents silent failures
- Clear validation feedback

### Visual Design: Status Pill Pattern

**Mapping:** Status → Color scheme (consistent across views)
```typescript
const STATUS_PILL_CLASS: Record<InspectionStatus, string> = {
  "NOT_STARTED": "bg-white text-slate-900 border-slate-300",
  "IN_PROGRESS": "bg-cyan-400 text-slate-950 border-cyan-500",
  "INCOMPLETE": "bg-yellow-300 text-slate-950 border-yellow-400",
  "PASSED": "bg-green-500 text-white border-green-600",
};
```

**Benefits:**
- Intuitive color psychology
- Accessible contrast ratios
- Unified design language
- Easy to scan status at a glance

### Responsive Layout: Grid-Based Section Items

**Pattern:** 3-column grid for checklist items
```
┌─────────────────────────────────────────┐
│ [✓] Item Label (Rule Code on right)     │  ← 44px | 1fr | 120px
└─────────────────────────────────────────┘
```

**Benefits:**
- Scalable to mobile (single column)
- Rule code always visible
- Consistent spacing
- Accessible touch targets (min 44px)

### Form Handling: Controlled Components with Drafts

**Pattern:** Separate draft state for NUMBER inputs
```typescript
const [textDraft, setTextDraft] = useState("");

useEffect(() => {
  if (item.inputType === "NUMBER") {
    setTextDraft(value !== null ? String(value) : "");
  }
}, [value, item.inputType]);

// onBlur triggers validation and submission
```

**Benefits:**
- Allows typing invalid values (user feedback)
- Only commits valid values to server
- Prevents auto-submission on keystroke
- Decouples input format from stored value

### Search & Filter: Memoized Derived State

**Pattern:** useMemo to prevent unnecessary recalculation
```typescript
const filteredTeams = useMemo(() => {
  return teams
    .filter(team => matchesSearch(team, search))
    .sort(byTeamNumber);
}, [search, teams]);  // Only recalculate when inputs change
```

**Benefits:**
- O(n) filter runs only when needed
- Stable reference for components
- Prevents infinite re-renders

### Checklist Grouping: Dynamic Section Mapping

**Pattern:** Build section groups on demand
```typescript
function buildSectionGroups(definition: ChecklistDefinition): SectionGroup[] {
  const itemsBySection = new Map<string, ChecklistItem[]>();
  
  for (const item of definition.items) {
    itemsBySection.get(item.sectionId)?.push(item);
  }
  
  return definition.sections
    .sort((a, b) => a.order - b.order)
    .map(section => ({
      section,
      items: itemsBySection.get(section.id) ?? []
    }));
}
```

**Benefits:**
- O(n) single pass
- Groups maintain section order
- Empty sections shown (no items hidden)
- Testable pure function

---

## 6. API Endpoints Summary

### Inspector Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---|
| GET | `/api/events/:eventCode/inspection/teams` | List all teams + status counts | Yes (Inspector) |
| GET | `/api/events/:eventCode/inspection/teams/:teamNumber` | Fetch team inspection detail | Yes (Inspector) |
| PATCH | `/api/events/:eventCode/inspection/teams/:teamNumber/items` | Update checklist responses | Yes (Inspector) |
| PATCH | `/api/events/:eventCode/inspection/teams/:teamNumber/status` | Change inspection status | Yes (Inspector) |
| POST | `/api/events/:eventCode/inspection/teams/:teamNumber/comment` | Save inspection comment | Yes (Inspector) |

### Public Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---|
| GET | `/api/events/:eventCode/inspection/public-status` | Public status display | No |

### Admin Endpoints (Not fully shown in code)

- PATCH `/api/events/:eventId/inspection/checklist` - Create/activate checklist version
- DELETE `/api/events/:eventId/inspection/overrides` - Override inspection status

## 8. Frontend Component Structure

```
Routes
├── /event-control/$eventCode/inspect/
│   └── index.tsx (InspectTeamsRoute)
│       ├── Team list with search
│       ├── Status legend
│       └── Progress bar
│
└── /event-control/$eventCode/inspect/$teamNumber
    └── $teamNumber.tsx (InspectionDetailRoute)
        ├── Team header + status buttons
        ├── Checklist sections
        │   └── ChecklistInput (reusable component)
        └── Comments section
            └── Previous comments history
```

## 9. UI Design Guidelines & Wireframes

### Aesthetics & Principles
- **Style**: Boxy, sharp design with high information density.
- **Color Palette**: High contrast status colors for instant recognition:
  - `not-started`: White background, dark text
  - `in_progress`: Cyan background, dark text
  - `incomplete`: Yellow background, dark text
  - `passed`: Green background, white text
- **Layout**: Tabular grids for checklists, clear section headers with vibrant background colors (e.g., orange for categories like General, Mechanical, Electrical) to visually separate rule groups.
- **Typography**: Clean, monospace or simple sans-serif fonts to ensure rule numbers and metrics are easily scannable.

### Wireframes (ASCII)

#### Team List View (`/inspect`)
```text
+-------------------------------------------------------------+
| << Back to Event Home                   Lead Inspector Override|
|                                         View Inspection Notes  |
| Robot Inspection - NRC 2026                                   |
|                                                               |
| Legend:                                                       |
| [Not Started] [In Progress] [Incomplete] [Passed]              |
|                                                               |
| [=================== 100% Passed ============================]  |
|                                                               |
| Select a team to inspect:               [Alternate QR Scanning]|
| +------+-------------------+-------------+---------------+    |
| | Team | Name              | Status      | Inspect       |    |
| +------+-------------------+-------------+---------------+    |
| | 1    | Team Unlimited    | [ Passed ]  | Inspect       |    |
| | 2    |                   | [ Passed ]  | Inspect       |    |
| | 3    |                   | [ Passed ]  | Inspect       |    |
| +------+-------------------+-------------+---------------+    |
+-------------------------------------------------------------+
```

#### Inspection Detail View (`/inspect/$teamNumber`)
```text
+-------------------------------------------------------------+
| << Back to Team Select                                        |
| Inspection Checklist                                          |
| Team Number: 1   [Scan QR] [QR Help]  [Mark In Progress]      |
|                                                               |
| +---+---------------------------------------------+---------+ |
| | V | General                                     | Rule #  | |
| +---+---------------------------------------------+---------+ |
| |   | ROBOT is presented at inspection...         | I304    | |
| |   | ROBOT has two ROBOT SIGNS...                | R401    | |
| +---+---------------------------------------------+---------+ |
| | V | Mechanical                                  | Rule #  | |
| +---+---------------------------------------------+---------+ |
| |   | ROBOT does not contain any COMPONENTS...    | R201... | |
| +---+---------------------------------------------+---------+ |
|                                                               |
| General Comments or Reason(s) for Incomplete:                 |
| +---------------------------------------------------------+   |
| |                                                         |   |
| |                                                         |   |
| +---------------------------------------------------------+   |
| [Save Comment]                      [Previous Event Comments] |
|                                                               |
|                    [ Pass ]  [ Incomplete ]                   |
+-------------------------------------------------------------+
```

---

## Summary

The **Robot Inspection** feature implements a robust, auditable system for managing event robot compliance. It uses:

- **Clear state machine** for status management
- **Immutable version control** for checklists
- **Flat normalized structure** for responses
- **Query-driven UI** for real-time updates
- **Role-based access** for security
- **Public/private data separation** for audience displays

The architecture prioritizes **data integrity**, **auditability**, and **inspector efficiency** through thoughtful separation of concerns and reusable patterns.
