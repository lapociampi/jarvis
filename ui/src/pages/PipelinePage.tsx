import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApiData } from "../hooks/useApi";
import { PipelineList } from "../components/pipeline/PipelineList";
import { PipelineDetail } from "../components/pipeline/PipelineDetail";
import { ContentCreateModal } from "../components/pipeline/ContentCreateModal";
import type { ContentItem } from "../components/pipeline/PipelineItemCard";
import type { ContentEvent } from "../hooks/useWebSocket";

type Props = {
  contentEvents: ContentEvent[];
  sendMessage: (text: string) => void;
};

export default function PipelinePage({ contentEvents, sendMessage }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const lastProcessedRef = useRef(0);

  const { data: items, refetch } = useApiData<ContentItem[]>(
    "/api/content",
    [refreshKey]
  );
  const [localItems, setLocalItems] = useState<ContentItem[]>([]);

  // Sync fetched items into local state
  useEffect(() => {
    if (items) {
      setLocalItems(items);
    }
  }, [items]);

  // Process real-time content events
  useEffect(() => {
    if (!contentEvents || contentEvents.length === 0) return;

    const newEvents = contentEvents.filter((e) => e.timestamp > lastProcessedRef.current);
    if (newEvents.length === 0) return;

    lastProcessedRef.current = newEvents[newEvents.length - 1]!.timestamp;

    setLocalItems((prev) => {
      let updated = [...prev];
      const newUpdatedIds = new Set<string>();

      for (const event of newEvents) {
        const { action, item } = event;
        const idx = updated.findIndex((t) => t.id === item.id);

        if (action === "created") {
          if (idx === -1) {
            updated.push(item);
            newUpdatedIds.add(item.id);
          }
        } else if (action === "updated") {
          if (idx !== -1) {
            updated[idx] = item;
          } else {
            updated.push(item);
          }
          newUpdatedIds.add(item.id);
        } else if (action === "deleted") {
          if (idx !== -1) {
            updated.splice(idx, 1);
          }
          if (selectedId === item.id) {
            setSelectedId(null);
          }
        }
      }

      if (newUpdatedIds.size > 0) {
        setRecentlyUpdated((prev) => new Set([...prev, ...newUpdatedIds]));
        setTimeout(() => {
          setRecentlyUpdated((prev) => {
            const next = new Set(prev);
            for (const id of newUpdatedIds) next.delete(id);
            return next;
          });
        }, 1500);
      }

      return updated;
    });

    // Also bump refresh for detail panel if the selected item was updated
    const touchedSelected = newEvents.some(
      (e) => e.item.id === selectedId && e.action === "updated"
    );
    if (touchedSelected) {
      setRefreshKey((k) => k + 1);
    }
  }, [contentEvents, selectedId]);

  const handleCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
    refetch();
  }, [refetch]);

  const handleChanged = useCallback(() => {
    refetch();
  }, [refetch]);

  // Sort: non-published first, then by updated_at desc
  const sortedItems = [...localItems].sort((a, b) => {
    if (a.stage === "published" && b.stage !== "published") return 1;
    if (a.stage !== "published" && b.stage === "published") return -1;
    return b.updated_at - a.updated_at;
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: List panel */}
      <PipelineList
        items={sortedItems}
        selectedId={selectedId}
        recentlyUpdated={recentlyUpdated}
        onSelect={setSelectedId}
        onCreate={() => setModalOpen(true)}
      />

      {/* Right: Detail panel */}
      <PipelineDetail
        itemId={selectedId}
        refreshKey={refreshKey}
        sendMessage={sendMessage}
        onDeleted={handleDeleted}
        onChanged={handleChanged}
      />

      {/* Create modal */}
      <ContentCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
