declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'

  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number
  }

  type Icon = FC<IconProps>

  export const Flame: Icon
  export const FolderDown: Icon
  export const FolderUp: Icon
  export const LayoutDashboard: Icon
  export const Rotate3d: Icon
  export const Save: Icon
  export const SendHorizonal: Icon
  export const Compass: Icon
  export const History: Icon
  export const Layers: Icon
  export const Loader2: Icon
  export const Scissors: Icon
  export const Sparkles: Icon
  export const Wand2: Icon
  export const Focus: Icon
  export const Trash2: Icon
  export const UploadCloud: Icon
  export const Upload: Icon
  export const ChevronDown: Icon
  export const ChevronUp: Icon
  export const ChevronRight: Icon
  export const ChevronsDown: Icon
  export const ChevronsUp: Icon
  export const Eye: Icon
  export const EyeOff: Icon
  export const Search: Icon
  export const Palette: Icon
  export const Ruler: Icon
  export const Shapes: Icon
  export const SplitSquareVertical: Icon
}

