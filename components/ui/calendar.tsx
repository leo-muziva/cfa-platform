"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

/** react-day-picker themed with the CFA purple; colours live in globals.css under .cfa-calendar. */
function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return <DayPicker className={cn("cfa-calendar", className)} {...props} />;
}

export { Calendar };
