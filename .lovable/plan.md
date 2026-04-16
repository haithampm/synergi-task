

## Plan: Add clickable team member profile sheet

### What changes
1. **`src/pages/Team.tsx`** — Add a Sheet (side panel) that opens when clicking a team member card or table row. The sheet displays:
   - Avatar, name, role, status badge, email
   - Task completion progress bar with stats
   - Mock task list showing assigned tasks (filtered from `tasks` mock data by assignee name)
   - "Send Message" button

   Implementation: Add `selectedMember` state, wrap cards/rows with `onClick` + `cursor-pointer`, import Sheet components and render a right-side Sheet with member details.

2. **Also fix build errors** in the same pass:
   - **`supabase/functions/ai-agent/index.ts`** line 144: Replace `.catch(() => {})` with `.then(() => {}).catch(() => {})` or wrap in try/catch
   - **`src/hooks/useProjects.ts`** line 134: Add proper typing to the update object instead of `{ [key: string]: any }`

### Technical details
- Uses existing `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` components
- Filters `tasks` from mock-data by matching `task.assignee` to `member.name`
- Cards get `cursor-pointer` class and `onClick={() => setSelectedMember(member)}`
- Table rows also become clickable
- Sheet closes via `onOpenChange` setting `selectedMember` to `null`

