UI Guidelines
One rule for every page: it should look like the Dashboard. If a screen needs something this guide does not cover, copy the closest existing piece instead of inventing a new style.

1. Principles
   • Uniform: same font sizes, weights, colours and spacing on every page.
   • Plain cells: no bold, no highlighted text and no extra colours inside table cells. Only badges, pills and buttons carry colour.
   • Shared first: use UniversalTable, StatusBadge and the standard filter pills. Do not copy table markup into a page.
   • Black and white base: black is the only accent (buttons, active tabs, active pills, icon circles). Pastel colours are for KPI cards and status badges only.
2. Foundations
   Item
   Rule
   Font
   Poppins (font-poppins) everywhere
   Page background
   bg-gray-50 / #f9fafb; cards and header are bg-white
   Text colours
   Main text-gray-800, secondary text-gray-600, muted text-gray-400
   Borders
   border-gray-100 (cards, tables), border-gray-300 (buttons, inputs)
   Radius
   rounded-lg for buttons, inputs and KPI cards; rounded-xl for cards; rounded-full for badges
   Page padding
   px-4 sm:px-6
   Grid gap
   gap-4
   Icons
   Lucide or Solar outline, w-4 h-4 inline, w-5 h-5 in KPI circles
3. Typography
   Use
   Classes
   Page title
   text-lg sm:text-2xl font-medium
   Page subtitle
   text-[10px] sm:text-[13px] text-gray-400 font-light
   Section heading
   text-base font-medium text-gray-800
   Table header
   text-[12px] font-medium text-gray-700
   Table cell and body text
   text-[12px] text-gray-800
   Button text
   text-xs
   Badge text
   text-[11px] or text-[12px]
   Labels above fields
   text-[12px] text-gray-600
   Empty, loading, helper text
   text-[12px] text-gray-400
4. Page structure
   Every page uses the same shell:
5. DashboardLayout wraps the page.
6. HeaderGlobal at the top.
7. Page title and subtitle (and page-level buttons on the right).
8. TabBar when the page has tabs.
9. Content with mt-6 flex flex-col gap-6.
10. One page-level toast container. Tabs never mount their own.
    The hidden-scrollbar helper (scrollbar-hide) lives in index.css, not in each page.
11. Tabs
    Use the shared TabBar component only.
    • Container: border-b flex flex-wrap gap-4 sm:gap-6 pt-4 text-sm
    • Active tab: border-b-2 border-black font-medium text-black
    • Inactive tab: text-[#AFAFAF]
    • Tab labels never wrap inside a tab (whitespace-nowrap).
12. KPI cards
    • Card: rounded-lg p-3 shadow-sm flex items-center gap-3 with a pastel background.
    • Icon: black circle, min-w-10 h-10, white icon.
    • Label: text-[10px] sm:text-xs uppercase font-semibold text-gray-500.
    • Value: text-lg sm:text-xl font-medium text-gray-800.
    • Palette: green #EBFDEF, blue #E8EFF9, orange #FFEFE7, yellow #FFFBDB, red #FFDADA.
    • No extra hint lines under the value.
13. Buttons
    Type
    Classes
    Primary
    px-3 sm:px-4 py-3 text-xs rounded-lg bg-black text-white hover:bg-gray-800
    Secondary
    px-3 sm:px-4 py-3 text-xs rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50
    Disabled
    add disabled:opacity-40 disabled:cursor-not-allowed
    Primary buttons on the same row always share the same padding.
14. Filter pills
    The status filter is always All / Pending / Approved / Rejected.
    • Size: px-3 py-1.5 text-xs rounded-md border transition
    • Active: bg-black text-white border-black
    • Inactive: bg-white text-gray-700 border-gray-300 hover:bg-gray-50
    • Placed next to the search box (passed to the table as actions).
    • Each tab owns its own filter state and filters the loaded rows by status.
    Pages with many filters (sort, department, dates) use one FilterMenu (filter icon with a panel) instead of loose controls. Expand all and Collapse all live inside that panel.
15. Search box
    • Table search: small gray box, w-full sm:w-40, text-xs, search icon on the right.
    • Page-level search: border px-3 py-2 rounded-lg bg-white text-sm, placeholder text-[12px].
16. Tables
    All tables use UniversalTable.
    Rule
    Value
    Wrapper
    p-2 rounded-2xl, title at top left, search at top right
    Rows per page
    6 (default)
    Header
    White, left-aligned for the first column, px-4 py-3
    Cells
    px-4 py-3, text-[12px], same widths as the header (fixed colgroup)
    Alignment
    First column (name) left, every other column centered
    Row
    hover:bg-gray-50, border-gray-300 divider
    Pagination
    "Showing 1-6 of N" with prev/next arrow buttons
    Empty state
    "No ... found", centered, text-gray-500
    Loading
    Blue dashed spinner, centered
    Columns
    Declared as columns with key, label, width (percent) and optional render
    Character limits (set inside each tab, not in the table)
    Long text is cut with ... and shows the full value on hover (title). The limit grows with the screen:
    Screen width
    Name
    Second text column
    under 640px
    10
    8
    640 to 1023px
    14
    10
    1024 to 1279px
    18
    14
    1280px and up
    24
    22
    Every tab uses the same LimitedText helper and useCharLimits hook pattern.
17. Status badges
    Use the shared StatusBadge. Never colour a status by hand.
    Status
    Colour
    Approved, Completed, Online
    bg-green-100 text-green-600
    Pending, In progress
    bg-orange-100 text-orange-600
    Rejected, Revoked, Absent, Inactive
    bg-red-100 text-red-600
    Late
    bg-purple-100 text-purple-600
    Not started, Cancelled
    bg-gray-100 text-gray-600
    Anything else
    bg-blue-100 text-blue-600
    Shape: px-3 py-1 rounded-full w-[85px] text-center text-[12px] truncate. Text is normal case, never uppercase.
18. Cards and sections
    • Card: bg-white shadow rounded-xl p-4 border border-gray-100.
    • Card heading: section heading style, with an optional muted description under it.
    • Separators inside a card: border-gray-100.
    • Progress bars: black fill on bg-gray-100, h-1.5 rounded-full, percentage in text-[12px].
19. Forms
    • Field: w-full border border-gray-300 bg-white px-3 py-2 rounded-lg text-sm text-gray-600.
    • Focus: focus:outline-none focus:border-black.
    • Disabled: disabled:bg-gray-50 disabled:text-gray-400.
    • Label above the field, text-[12px] text-gray-600.
    • Buttons at the bottom, right-aligned on desktop, full width on phones.
    • Save is enabled only when something changed; show "You have unsaved changes" in muted text.
20. Overlays
    • Backdrop: bg-black/30 backdrop-blur-[2px].
    • Side panel: sm:w-[450px], slides in from the right.
    • Modals close on outside click, Escape and the X button.
21. States
    State
    Look
    Loading
    Spinner border-2 border-gray-200 border-t-black, text text-[12px] text-gray-400
    Error
    Red text (text-red-500 text-xs) with a black "Try again" button
    Empty
    Centered muted text inside the table or card
    Toasts
    One page-level container. Messages come from the backend response where possible
22. Shared pieces to reuse
    Piece
    Purpose
    TabBar
    Page tabs
    UniversalTable
    Every table
    StatusBadge and getStatusColor
    Status pills
    FilterMenu
    Multi-filter panel with Expand all and Collapse all
    Status filter pills
    All / Pending / Approved / Rejected, built inside each tab
    LimitedText and useCharLimits
    Responsive character limits
23. Checklist before you ship a page
    [ ] Poppins, no custom fonts.
    [ ] Page title and subtitle match the Dashboard sizes.
    [ ] Tabs use TabBar.
    [ ] Table uses UniversalTable, name column left, others centered.
    [ ] Cells are plain: no bold, no coloured text.
    [ ] Status shown with StatusBadge.
    [ ] Status filter pills present where the data has a status.
    [ ] Long text uses the responsive character limit with a hover title.
    [ ] Buttons use the standard primary and secondary styles.
    [ ] One page-level toast container, none inside tabs.
    [ ] No inline <style> blocks that affect global elements (tables, td, tr).
