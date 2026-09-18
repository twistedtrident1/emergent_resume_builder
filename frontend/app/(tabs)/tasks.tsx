import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";

import { api } from "@/src/api/client";
import { Celebration } from "@/src/components/Celebration";
import { SUGGESTION_CATEGORIES } from "@/src/data/suggestions";
import { storage } from "@/src/utils/storage";
import { colors, radius, spacing } from "@/src/theme";

const LAST_CELEBRATED_KEY = "last_celebrated_date";

type TaskItem = {
  id: string;
  title: string;
  notes?: string | null;
  recurring: boolean;
  date?: string | null;
  completed: boolean;
};

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeek(anchor: Date): Date[] {
  // Show ±10 days around anchor in a horizontal scroller; 21 chips
  const start = new Date(anchor);
  start.setDate(start.getDate() - 10);
  const out: Date[] = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

function CheckBox({ checked, onPress, testID }: { checked: boolean; onPress: () => void; testID?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handle = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Pressable onPress={handle} hitSlop={10} testID={testID}>
      <Animated.View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          { transform: [{ scale }] },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={colors.surface} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export default function TasksScreen() {
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<Date>(today);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickedCat, setPickedCat] = useState<string>(SUGGESTION_CATEGORIES[0].key);
  const [quickAdding, setQuickAdding] = useState<Set<string>>(new Set());
  const [actionFor, setActionFor] = useState<TaskItem | null>(null);
  const [noteFor, setNoteFor] = useState<TaskItem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [celebrate, setCelebrate] = useState<{ visible: boolean; streak: number; total: number }>({
    visible: false,
    streak: 0,
    total: 0,
  });
  const lastAllDoneRef = useRef(false);
  const stripRef = useRef<ScrollView | null>(null);

  const dateStr = fmt(selected);
  const days = useMemo(() => buildWeek(today), [today]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api<TaskItem[]>(`/tasks?date=${dateStr}`);
      setTasks(t);
    } catch (e) {
      console.warn("load tasks failed", e);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset the "all done" sentinel when the selected day changes so revisiting a
  // fully-completed day doesn't re-celebrate. Also hydrate it from storage to
  // survive cold launches on a day that was already celebrated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const last = await storage.getItem<string>(LAST_CELEBRATED_KEY, "");
      if (cancelled) return;
      lastAllDoneRef.current = last === dateStr;
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr]);

  const triggerCelebrationIfDone = useCallback(
    async (after: TaskItem[]) => {
      const total = after.length;
      const done = after.filter((x) => x.completed).length;
      const allDone = total > 0 && done === total;
      if (allDone && !lastAllDoneRef.current) {
        lastAllDoneRef.current = true;
        await storage.setItem(LAST_CELEBRATED_KEY, dateStr);
        try {
          const s = await api<{ streak: number }>(`/streak?date=${dateStr}`);
          setCelebrate({ visible: true, streak: s.streak, total });
        } catch {
          setCelebrate({ visible: true, streak: 1, total });
        }
      } else if (!allDone) {
        lastAllDoneRef.current = false;
      }
    },
    [dateStr]
  );

  const toggle = async (t: TaskItem) => {
    // optimistic
    const nextTasks = tasks.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x));
    setTasks(nextTasks);
    if (!t.completed) {
      // task was just marked complete — maybe celebrate
      triggerCelebrationIfDone(nextTasks);
    }
    try {
      if (!t.completed) {
        await api(`/tasks/${t.id}/complete?date=${dateStr}`, { method: "POST" });
      } else {
        await api(`/tasks/${t.id}/uncomplete?date=${dateStr}`, { method: "POST" });
      }
    } catch (e) {
      console.warn("toggle failed", e);
      // revert
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: t.completed } : x)));
    }
  };

  const remove = async (t: TaskItem) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await api(`/tasks/${t.id}`, { method: "DELETE" });
    } catch (e) {
      console.warn("delete failed", e);
      load();
    }
  };

  const snoozeToTomorrow = async (t: TaskItem) => {
    if (t.recurring) {
      // For recurring tasks, "snooze" means "skip just today" — the task
      // remains a daily routine and reappears tomorrow.
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      try {
        await api(`/tasks/${t.id}/skip?date=${dateStr}`, { method: "POST" });
      } catch (e) {
        console.warn("skip failed", e);
        load();
      }
      return;
    }
    // One-time task — change its date to tomorrow
    const next = new Date(selected);
    next.setDate(next.getDate() + 1);
    const nextStr = fmt(next);
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await api(`/tasks/${t.id}`, { method: "PATCH", body: { date: nextStr } });
    } catch (e) {
      console.warn("snooze failed", e);
      load();
    }
  };

  const move = async (t: TaskItem, dir: "up" | "down") => {
    const idx = tasks.findIndex((x) => x.id === t.id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;
    const next = [...tasks];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setTasks(next);
    const items = next.map((x, i) => ({ id: x.id, sort_index: i + 1 }));
    try {
      await api(`/tasks/reorder`, { method: "POST", body: { items } });
    } catch (e) {
      console.warn("reorder failed", e);
      load();
    }
  };

  const saveNote = async () => {
    if (!noteFor) return;
    const text = noteText.trim();
    const target = noteFor;
    setTasks((prev) => prev.map((x) => (x.id === target.id ? { ...x, notes: text || null } : x)));
    setNoteFor(null);
    setNoteText("");
    try {
      await api(`/tasks/${target.id}`, {
        method: "PATCH",
        body: { notes: text || "" },
      });
    } catch (e) {
      console.warn("save note failed", e);
      load();
    }
  };

  const onDragEnd = async ({ data }: { data: TaskItem[] }) => {
    setTasks(data);
    const items = data.map((x, i) => ({ id: x.id, sort_index: i + 1 }));
    try {
      await api(`/tasks/reorder`, { method: "POST", body: { items } });
    } catch (e) {
      console.warn("reorder failed", e);
      load();
    }
  };

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TaskItem>) => (
      <ScaleDecorator>
        <Pressable
          onLongPress={() => setActionFor(item)}
          delayLongPress={400}
          style={({ pressed }) => [
            styles.row,
            item.completed && styles.rowDone,
            (pressed || isActive) && { opacity: 0.92 },
            isActive && styles.rowDragging,
          ]}
          testID={`task-row-${item.id}`}
        >
          <CheckBox
            checked={item.completed}
            onPress={() => toggle(item)}
            testID={`task-checkbox-${item.id}`}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.rowTitle, item.completed && styles.rowTitleDone]}
              testID={`task-title-${item.id}`}
            >
              {item.title}
            </Text>
            {item.notes ? (
              <Text style={styles.rowNote} testID={`task-note-${item.id}`} numberOfLines={2}>
                {item.notes}
              </Text>
            ) : null}
            {item.recurring ? (
              <View style={styles.recurPill}>
                <Ionicons name="repeat" size={11} color={colors.primary} />
                <Text style={styles.recurText}>Daily</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setActionFor(item)}
            hitSlop={10}
            style={styles.rowMore}
            testID={`task-more-${item.id}`}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <Pressable
            onPress={() => setActionFor(item)}
            onLongPress={drag}
            delayLongPress={180}
            hitSlop={10}
            style={styles.dragHandle}
            testID={`task-drag-${item.id}`}
          >
            <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks]
  );

  const submitNew = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      const body: { title: string; recurring: boolean; date?: string } = {
        title,
        recurring: newRecurring,
      };
      if (!newRecurring) body.date = dateStr;
      const created = await api<TaskItem>("/tasks", { method: "POST", body });
      setTasks((prev) => [...prev, created]);
      setNewTitle("");
      setNewRecurring(false);
      setAddOpen(false);
    } catch (e) {
      console.warn("create failed", e);
    } finally {
      setSaving(false);
    }
  };

  // Tap-to-add-instantly: tapping a suggestion immediately creates the task as a
  // daily routine. Sheet stays open so the user can keep adding more.
  const quickAdd = async (suggestion: string) => {
    // De-dupe vs already-present recurring tasks by title (case-insensitive)
    const already = tasks.find(
      (t) => t.recurring && t.title.trim().toLowerCase() === suggestion.toLowerCase()
    );
    if (already || quickAdding.has(suggestion)) return;
    setQuickAdding((s) => new Set(s).add(suggestion));
    try {
      const created = await api<TaskItem>("/tasks", {
        method: "POST",
        body: { title: suggestion, recurring: true },
      });
      setTasks((prev) => [...prev, created]);
    } catch (e) {
      console.warn("quick add failed", e);
    } finally {
      setQuickAdding((s) => {
        const next = new Set(s);
        next.delete(suggestion);
        return next;
      });
    }
  };

  const done = tasks.filter((t) => t.completed).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="tasks-screen">
      <View style={styles.header}>
        <Text style={styles.tag}>YOUR PLAN</Text>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.sub}>
          {done} of {tasks.length} done · {selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </Text>
      </View>

      {/* Horizontal date strip (sticky chrome) */}
      <View style={styles.stripWrap} testID="date-strip">
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          onContentSizeChange={() => {
            // Center today (index 10 of 21) on first layout. Each chip is 56 wide
            // with a 10px gap; subtract ~2 chip-widths so today sits as the 3rd
            // visible chip, leaving prior days visible to the left.
            const CHIP = 66; // 56 width + 10 gap
            const x = Math.max(0, 10 * CHIP - 2 * CHIP);
            stripRef.current?.scrollTo({ x, animated: false });
          }}
        >
          {days.map((d) => {
            const isSel = fmt(d) === dateStr;
            const isToday = fmt(d) === fmt(today);
            return (
              <TouchableOpacity
                key={fmt(d)}
                onPress={() => setSelected(d)}
                style={[styles.dayChip, isSel && styles.dayChipSel]}
                testID={`day-chip-${fmt(d)}`}
              >
                <Text style={[styles.dayWk, isSel && styles.daySelText]}>
                  {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
                </Text>
                <Text style={[styles.dayNum, isSel && styles.daySelText]}>
                  {d.getDate()}
                </Text>
                {isToday ? <View style={[styles.dot, isSel && { backgroundColor: colors.surface }]} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : tasks.length === 0 ? (
        <View style={styles.empty} testID="tasks-empty">
          <View style={styles.emptyCircle}>
            <Ionicons name="sunny-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>A quiet day, so far.</Text>
          <Text style={styles.emptySub}>
            Tap the + button to add a daily routine or a one-off task.
          </Text>
        </View>
      ) : (
        <DraggableFlatList
          data={tasks}
          keyExtractor={(i) => i.id}
          containerStyle={styles.listContainer}
          contentContainerStyle={styles.list}
          onDragEnd={onDragEnd}
          renderItem={renderItem}
          activationDistance={8}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddOpen(true)}
        testID="add-task-btn"
      >
        <Ionicons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>

      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
          <View style={styles.sheet} testID="add-task-sheet">
            <View style={styles.handle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>New task</Text>
              <Text style={styles.sheetSub}>
                Type something custom, or tap suggestions below to add them instantly.
              </Text>

              {/* Custom typed task */}
              <TextInput
                placeholder="What would feel good to do?"
                placeholderTextColor={colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
                style={styles.input}
                testID="new-task-input"
              />

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setNewRecurring((v) => !v)}
                testID="new-task-recurring-toggle"
              >
                <View style={[styles.switch, newRecurring && styles.switchOn]}>
                  <View
                    style={[
                      styles.switchKnob,
                      newRecurring && styles.switchKnobOn,
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Daily routine</Text>
                  <Text style={styles.toggleSub}>
                    {newRecurring
                      ? "Will appear every day until you delete it."
                      : `Just for ${selected.toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, (!newTitle.trim() || saving) && { opacity: 0.5 }]}
                disabled={!newTitle.trim() || saving}
                onPress={submitNew}
                testID="new-task-save-btn"
              >
                {saving ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.saveBtnText}>Add this task</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Suggestion picker — tap to add instantly */}
              <Text style={styles.suggestLabel}>OR TAP TO ADD INSTANTLY</Text>
              <Text style={styles.suggestHint}>
                Each tap adds it as a daily routine. Great for the things you
                know you keep forgetting.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
                testID="suggestion-category-row"
              >
                {SUGGESTION_CATEGORIES.map((cat) => {
                  const active = pickedCat === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setPickedCat(cat.key)}
                      style={[styles.catChip, active && styles.catChipActive]}
                      testID={`suggestion-cat-${cat.key}`}
                    >
                      <Ionicons
                        name={cat.icon as keyof typeof Ionicons.glyphMap}
                        size={14}
                        color={active ? colors.surface : colors.textSecondary}
                      />
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.suggestListContent}>
                {(SUGGESTION_CATEGORIES.find((c) => c.key === pickedCat)?.suggestions ?? []).map(
                  (s) => {
                    const alreadyAdded = tasks.some(
                      (t) => t.recurring && t.title.trim().toLowerCase() === s.toLowerCase()
                    );
                    const pending = quickAdding.has(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => quickAdd(s)}
                        disabled={alreadyAdded || pending}
                        style={[
                          styles.suggestChip,
                          alreadyAdded && styles.suggestChipDone,
                        ]}
                        testID={`suggestion-${s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                      >
                        {pending ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : alreadyAdded ? (
                          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        ) : (
                          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                        )}
                        <Text style={[styles.suggestChipText, alreadyAdded && styles.suggestChipTextDone]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setAddOpen(false)}
                testID="add-sheet-done"
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={!!actionFor}
        transparent
        animationType="fade"
        onRequestClose={() => setActionFor(null)}
      >
        <Pressable style={styles.actionRoot} onPress={() => setActionFor(null)}>
          <Pressable style={styles.actionSheet} testID="task-action-sheet">
            <View style={styles.handle} />
            <Text style={styles.actionTitle} numberOfLines={1}>
              {actionFor?.title}
            </Text>
            <Text style={styles.actionSub}>What would you like to do?</Text>

            {actionFor ? (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  if (actionFor) snoozeToTomorrow(actionFor);
                  setActionFor(null);
                }}
                testID="action-snooze"
              >
                <Ionicons name="moon-outline" size={20} color={colors.primary} />
                <Text style={styles.actionItemText}>
                  {actionFor.recurring ? "Skip just today" : "Snooze to tomorrow"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (!actionFor) return;
                setNoteText(actionFor.notes ?? "");
                setNoteFor(actionFor);
                setActionFor(null);
              }}
              testID="action-edit-note"
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.actionItemText}>
                {actionFor?.notes ? "Edit note" : "Add a note"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionItem,
                tasks.findIndex((x) => x.id === actionFor?.id) <= 0 && styles.actionItemDisabled,
              ]}
              disabled={tasks.findIndex((x) => x.id === actionFor?.id) <= 0}
              onPress={() => {
                if (actionFor) move(actionFor, "up");
                setActionFor(null);
              }}
              testID="action-move-up"
            >
              <Ionicons name="arrow-up" size={20} color={colors.primary} />
              <Text style={styles.actionItemText}>Move up</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionItem,
                tasks.findIndex((x) => x.id === actionFor?.id) >= tasks.length - 1 &&
                  styles.actionItemDisabled,
              ]}
              disabled={tasks.findIndex((x) => x.id === actionFor?.id) >= tasks.length - 1}
              onPress={() => {
                if (actionFor) move(actionFor, "down");
                setActionFor(null);
              }}
              testID="action-move-down"
            >
              <Ionicons name="arrow-down" size={20} color={colors.primary} />
              <Text style={styles.actionItemText}>Move down</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => {
                if (actionFor) remove(actionFor);
                setActionFor(null);
              }}
              testID="action-delete"
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.actionItemText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCancel}
              onPress={() => setActionFor(null)}
              testID="action-cancel"
            >
              <Text style={styles.actionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Celebration
        visible={celebrate.visible}
        streak={celebrate.streak}
        totalDoneToday={celebrate.total}
        onClose={() => setCelebrate((s) => ({ ...s, visible: false }))}
      />

      <Modal
        visible={!!noteFor}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setNoteFor(null)} />
          <View style={styles.sheet} testID="note-sheet">
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Note</Text>
              <Text style={styles.sheetSub} numberOfLines={1}>
                {noteFor?.title}
              </Text>
              <TextInput
                placeholder='e.g. "the one in the green bottle"'
                placeholderTextColor={colors.textSecondary}
                value={noteText}
                onChangeText={setNoteText}
                style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
                multiline
                autoFocus
                testID="note-input"
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveNote}
                testID="note-save-btn"
              >
                <Text style={styles.saveBtnText}>Save note</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  tag: { fontSize: 11, letterSpacing: 2, color: colors.textSecondary, fontWeight: "500" },
  title: { fontSize: 30, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs },
  sub: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  stripWrap: {
    height: 88,
    paddingVertical: spacing.sm,
  },
  stripContent: {
    paddingHorizontal: spacing.lg,
    gap: 10,
    alignItems: "center",
  },
  dayChip: {
    flexShrink: 0,
    width: 56,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayChipSel: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  dayWk: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", letterSpacing: 1 },
  dayNum: { fontSize: 18, color: colors.textPrimary, fontWeight: "700" },
  daySelText: { color: colors.surface },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 140, gap: spacing.sm },
  listContainer: { flex: 1 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowDone: { opacity: 0.55, backgroundColor: colors.background },
  rowTitle: { fontSize: 16, color: colors.textPrimary, fontWeight: "500" },
  rowTitleDone: { textDecorationLine: "line-through", color: colors.textSecondary },
  rowNote: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: "italic",
  },
  recurPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  recurText: { color: colors.primary, fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },

  // Modal
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,62,56,0.4)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  sheetSub: { color: colors.textSecondary, fontSize: 14 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: colors.primary },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  switchKnobOn: { transform: [{ translateX: 18 }] },
  toggleTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  toggleSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  saveBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    marginTop: spacing.sm,
  },
  saveBtnText: { color: colors.surface, fontWeight: "600", fontSize: 16 },
  suggestLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  suggestHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  doneBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  catRow: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: spacing.lg,
  },
  catChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  catChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  catChipTextActive: { color: colors.surface },
  suggestList: { maxHeight: 180 },
  suggestListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    minHeight: 48,
  },
  suggestChipDone: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  suggestChipText: { color: colors.textPrimary, fontSize: 14, fontWeight: "500", flex: 1 },
  suggestChipTextDone: {
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  rowMore: {
    padding: 6,
  },
  rowDragging: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginLeft: 2,
  },
  actionRoot: {
    flex: 1,
    backgroundColor: "rgba(44,62,56,0.4)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  actionSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    minHeight: 52,
  },
  actionItemText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actionItemDisabled: { opacity: 0.35 },
  actionItemDanger: {},
  actionCancel: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  actionCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
