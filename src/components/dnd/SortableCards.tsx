import type { ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Grade/lista de cards com arrastar-e-mover (dnd-kit). Layout 'grid' = grade alinhada
 * (auto-fill); 'list' = coluna. `disabled` renderiza sem DnD (ex.: Geral só-leitura, busca ativa).
 * O card interno mantém seu próprio onClick — o arraste só começa após mover alguns pixels (mouse)
 * ou segurar (toque), então clicar para abrir continua funcionando.
 */
export function SortableCards<T extends { id: string }>({
  items,
  layout,
  disabled = false,
  onReorder,
  renderItem,
}: {
  items: T[]
  layout: 'grid' | 'list'
  disabled?: boolean
  /** Índices na lista visível (from → to). */
  onReorder: (from: number, to: number) => void
  renderItem: (item: T) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const containerClass = layout === 'grid' ? 'grid-cards' : 'flex flex-col gap-2'

  if (disabled) {
    return (
      <div className={containerClass}>
        {items.map((it) => (
          <div key={it.id}>{renderItem(it)}</div>
        ))}
      </div>
    )
  }

  const ids = items.map((it) => it.id)
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onReorder(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={containerClass}>
          {items.map((it) => (
            <SortableItem key={it.id} id={it.id}>
              {renderItem(it)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
      className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
