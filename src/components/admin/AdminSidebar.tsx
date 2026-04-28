import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { useAdminSidebarConfig, type NavItem } from "@/hooks/useAdminSidebarConfig";

// ── SortableNavItem ──

interface SortableNavItemProps {
  item: NavItem;
  dimmed?: boolean;
}

function SortableNavItem({ item, dimmed }: SortableNavItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? "bg-zinc-800 text-zinc-100"
              : dimmed
              ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`
        }
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {item.label}
      </NavLink>
    </div>
  );
}

// ── DragOverlay preview ──

function NavItemPreview({ item }: { item: NavItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-100 shadow-lg opacity-90 w-48">
      <item.icon className="h-4 w-4 flex-shrink-0" />
      {item.label}
    </div>
  );
}

// ── AdminSidebar ──

const AdminSidebar = () => {
  const { user } = useClerkAuth();
  const { activeItems, unusedItems, moveItem, reorderSection } = useAdminSidebarConfig(
    user?.id
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [unusedCollapsed, setUnusedCollapsed] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSection, setOverSection] = useState<"active" | "unused" | null>(null);

  // Combine for fast lookup
  const allItems = [...activeItems, ...unusedItems];
  const draggingItem = activeId ? allItems.find((i) => i.id === activeId) ?? null : null;

  const getItemSection = (id: string): "active" | "unused" =>
    activeItems.some((i) => i.id === id) ? "active" : "unused";

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverSection(null);
      return;
    }
    const overId = over.id as string;
    // over.id is either an item id or the section droppable id
    if (overId === "active-section" || activeItems.some((i) => i.id === overId)) {
      setOverSection("active");
    } else if (overId === "unused-section" || unusedItems.some((i) => i.id === overId)) {
      setOverSection("unused");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverSection(null);

    if (!over) return;

    const dragId = active.id as string;
    const overId = over.id as string;

    const sourceSection = getItemSection(dragId);
    // Determine destination section
    let destSection: "active" | "unused";
    if (overId === "active-section" || activeItems.some((i) => i.id === overId)) {
      destSection = "active";
    } else if (overId === "unused-section" || unusedItems.some((i) => i.id === overId)) {
      destSection = "unused";
    } else {
      destSection = sourceSection;
    }

    if (sourceSection !== destSection) {
      // Cross-section move
      const destItems = destSection === "active" ? activeItems : unusedItems;
      const overIndex = destItems.findIndex((i) => i.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : undefined;
      moveItem(dragId, destSection, insertAt);
    } else {
      // Within-section reorder
      const sectionItems = sourceSection === "active" ? activeItems : unusedItems;
      const oldIndex = sectionItems.findIndex((i) => i.id === dragId);
      const newIndex = sectionItems.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(
          sectionItems.map((i) => i.id),
          oldIndex,
          newIndex
        );
        reorderSection(sourceSection, reordered);
      }
    }
  }

  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">CDG Admin</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <nav className="flex-1 p-2 overflow-y-auto">
          {/* Active section */}
          <SortableContext
            id="active-section"
            items={activeItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {activeItems.map((item) => (
                <SortableNavItem key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>

          {/* Separator + Unused section */}
          <div className="border-t border-zinc-800 mt-2 pt-1">
            <button
              className="w-full text-xs uppercase tracking-wider text-zinc-600 px-3 py-2 flex items-center justify-between cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={() => setUnusedCollapsed((c) => !c)}
              type="button"
            >
              <span>Unused</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-200 ${
                  unusedCollapsed ? "" : "rotate-180"
                }`}
              />
            </button>

            {!unusedCollapsed && (
              <SortableContext
                id="unused-section"
                items={unusedItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {unusedItems.map((item) => (
                    <SortableNavItem key={item.id} item={item} dimmed />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </nav>

        <DragOverlay>
          {draggingItem ? <NavItemPreview item={draggingItem} /> : null}
        </DragOverlay>
      </DndContext>

      <div className="p-2 border-t border-zinc-800">
        <NavLink
          to="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pulse
        </NavLink>
      </div>
    </aside>
  );
};

export default AdminSidebar;
