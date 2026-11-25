"use client";
import { useEffect } from "react";

/** Chats open at the newest message, like a real messaging app. */
export default function ScrollToBottom() {
  useEffect(() => { window.scrollTo(0, document.body.scrollHeight); }, []);
  return null;
}
