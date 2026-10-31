import { CheckCircle2, Pause, AlertTriangle, BadgeCheck, Send, Printer, FileCheck2 } from "lucide-react";

export const StatusIcons = {
  active: (props?: { className?: string; size?: number }) => (
    <CheckCircle2 className={props?.className} size={props?.size ?? 16} />
  ),
  paused: (props?: { className?: string; size?: number }) => (
    <Pause className={props?.className} size={props?.size ?? 16} />
  ),
  overdue: (props?: { className?: string; size?: number }) => (
    <AlertTriangle className={props?.className} size={props?.size ?? 16} />
  ),
  paid: (props?: { className?: string; size?: number }) => (
    <BadgeCheck className={props?.className} size={props?.size ?? 16} />
  ),
};

export const ActionIcons = {
  confirm: (props?: { className?: string; size?: number }) => (
    <FileCheck2 className={props?.className} size={props?.size ?? 16} />
  ),
  print: (props?: { className?: string; size?: number }) => (
    <Printer className={props?.className} size={props?.size ?? 16} />
  ),
  send: (props?: { className?: string; size?: number }) => (
    <Send className={props?.className} size={props?.size ?? 16} />
  ),
};
