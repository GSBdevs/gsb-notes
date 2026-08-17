import {
  AlarmClock,
  AlertTriangle,
  Bell,
  BellPlus,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  Flag,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  Maximize2,
  MessageCircle,
  Monitor,
  Pencil,
  Pin,
  Plus,
  Power,
  RotateCcw,
  Search,
  SearchX,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Mapa kebab → componente lucide (os nomes batem com os do protótipo). */
const MAP: Record<string, LucideIcon> = {
  'alarm-clock': AlarmClock,
  'alert-triangle': AlertTriangle,
  bell: Bell,
  'bell-plus': BellPlus,
  'bell-ring': BellRing,
  calendar: CalendarDays,
  check: Check,
  'check-circle': CheckCircle,
  'chevron-right': ChevronRight,
  circle: Circle,
  clock: Clock,
  eye: Eye,
  flag: Flag,
  'layout-grid': LayoutGrid,
  'loader-2': Loader2,
  'log-out': LogOut,
  mail: Mail,
  'maximize-2': Maximize2,
  'message-circle': MessageCircle,
  monitor: Monitor,
  pencil: Pencil,
  pin: Pin,
  plus: Plus,
  power: Power,
  'rotate-ccw': RotateCcw,
  search: Search,
  'search-x': SearchX,
  settings: Settings,
  'share-2': Share2,
  smartphone: Smartphone,
  sparkles: Sparkles,
  tag: Tag,
  'trash-2': Trash2,
  'user-plus': UserPlus,
  users: Users,
  'volume-2': Volume2,
  x: X,
  zap: Zap,
}

interface IconProps {
  name: keyof typeof MAP | string
  size?: number
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}

export function Icon({ name, size = 16, className, style, strokeWidth = 2 }: IconProps) {
  const Cmp = MAP[name] ?? Circle
  return <Cmp size={size} className={className} style={style} strokeWidth={strokeWidth} />
}
