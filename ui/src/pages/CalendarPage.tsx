import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../hooks/useApi";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { CalendarDayDetail } from "../components/calendar/CalendarDayDetail";
import type { CalendarEvent } from "../components/calendar/CalendarEventBadge";
import type { TaskEvent, ContentEvent } from "../hooks/useWebSocket";

type Props = {
  taskEvents: TaskEvent[];
  contentEvents: ContentEvent[];
};

/** Get Monday of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekRange(weekStart: Date): { start: number; end: number } {
  const start = weekStart.getTime();
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 7);
  return { start, end: end.getTime() };
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} \u2013 ${endStr}`;
}

export default function CalendarPage({ taskEvents, contentEvents }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const lastTaskProcessed = useRef(0);
  const lastContentProcessed = useRef(0);

  const fetchEvents = useCallback(async (ws: Date) => {
    setLoading(true);
    try {
      const { start, end } = getWeekRange(ws);
      const data = await api<CalendarEvent[]>(
        `/api/calendar?range_start=${start}&range_end=${end}`
      );
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(weekStart);
  }, [weekStart, fetchEvents]);

  // Real-time: refetch on task events
  useEffect(() => {
    if (!taskEvents.length) return;
    const newEvents = taskEvents.filter(
      (e) => e.timestamp > lastTaskProcessed.current
    );
    if (newEvents.length === 0) return;
    lastTaskProcessed.current = newEvents[newEvents.length - 1]!.timestamp;
    fetchEvents(weekStart);
  }, [taskEvents, weekStart, fetchEvents]);

  // Real-time: refetch on content events
  useEffect(() => {
    if (!contentEvents.length) return;
    const newEvents = contentEvents.filter(
      (e) => e.timestamp > lastContentProcessed.current
    );
    if (newEvents.length === 0) return;
    lastContentProcessed.current = newEvents[newEvents.length - 1]!.timestamp;
    fetchEvents(weekStart);
  }, [contentEvents, weekStart, fetchEvents]);

  const prevWeek = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() - 7);
      return d;
    });
  }, []);

  const nextWeek = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + 7);
      return d;
    });
  }, []);

  const goToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
    setSelectedDate(new Date());
  }, []);

  const commitmentCount = events.filter((e) => e.type === "commitment").length;
  const contentCount = events.filter((e) => e.type === "content").length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--j-text)",
            }}
          >
            Calendar
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "12px",
              color: "var(--j-text-muted)",
            }}
          >
            {commitmentCount} task{commitmentCount !== 1 ? "s" : ""} {"\u00B7"}{" "}
            {contentCount} content event{contentCount !== 1 ? "s" : ""} this
            week
          </p>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "11px",
            color: "var(--j-text-muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--j-accent)",
              }}
            />
            Tasks
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#fbbf24",
              }}
            />
            Content
          </span>
        </div>
      </div>

      {/* Week navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0 24px 12px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={prevWeek}
          style={{
            background: "none",
            border: "1px solid var(--j-border)",
            borderRadius: "6px",
            color: "var(--j-text)",
            cursor: "pointer",
            padding: "6px 10px",
            fontSize: "14px",
          }}
        >
          {"\u2190"}
        </button>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--j-text)",
            minWidth: "220px",
            textAlign: "center",
          }}
        >
          {formatWeekRange(weekStart)}
        </span>
        <button
          onClick={nextWeek}
          style={{
            background: "none",
            border: "1px solid var(--j-border)",
            borderRadius: "6px",
            color: "var(--j-text)",
            cursor: "pointer",
            padding: "6px 10px",
            fontSize: "14px",
          }}
        >
          {"\u2192"}
        </button>
        <button
          onClick={goToday}
          style={{
            background: "rgba(0, 212, 255, 0.1)",
            border: "1px solid var(--j-accent)",
            borderRadius: "6px",
            color: "var(--j-accent)",
            cursor: "pointer",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          This Week
        </button>
        {loading && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--j-text-muted)",
              marginLeft: "auto",
            }}
          >
            Loading...
          </span>
        )}
      </div>

      {/* Weekly grid + day detail */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 24px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <CalendarGrid
          weekStart={weekStart}
          selectedDate={selectedDate}
          events={events}
          onSelectDate={setSelectedDate}
        />

        <CalendarDayDetail date={selectedDate} events={events} />
      </div>
    </div>
  );
}
