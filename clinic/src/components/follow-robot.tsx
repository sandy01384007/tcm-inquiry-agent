import { useState } from "react";
import { AiDoctorAvatar } from "@/components/ai-doctor";
import { Button } from "@/components/ui/button";
import { openRobot, stepRobot, type RobotLine, type RobotState } from "@/lib/tcm/follow-robot";
import type { FollowCheckin } from "@/lib/tcm/types";

export function FollowRobot({
  name,
  recheckItems,
  questions,
  words,
  onDone,
  onClose,
}: {
  name: string;
  recheckItems: string;
  questions: string[];
  words: string[];
  onDone: (checkin: FollowCheckin, log: RobotLine[]) => void;
  onClose: () => void;
}) {
  const opened = openRobot(name, recheckItems, questions);
  const [state, setState] = useState<RobotState>(opened.state);
  const [lines, setLines] = useState<RobotLine[]>([{ role: "robot", text: opened.say }]);
  const [choices, setChoices] = useState(opened.choices);
  const [text, setText] = useState("");
  const [closed, setClosed] = useState(false);

  function push(input: string) {
    if (closed) return;
    const turn = stepRobot(state, input, words);
    const next = [...lines, { role: "patient" as const, text: input }, { role: "robot" as const, text: turn.say }];
    setLines(next);
    setState(turn.state);
    setChoices(turn.choices);
    setText("");
    if (turn.checkin) {
      setClosed(true);
      onDone(turn.checkin, next);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <AiDoctorAvatar size={48} />
        <div>
          <p className="font-semibold text-seal">随访机器人</p>
          <p className="text-xs text-muted">只记录情况，遇急症会停止</p>
        </div>
      </div>
      <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {lines.map((line, i) => (
          <li key={i} className={line.role === "robot" ? "text-sm" : "text-right text-sm"}>
            <span
              className={
                line.role === "robot"
                  ? "inline-block max-w-[85%] rounded-2xl bg-secondary px-3 py-2"
                  : "inline-block max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-primary-foreground"
              }
            >
              {line.text}
            </span>
          </li>
        ))}
      </ul>
      {!closed && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {choices.map((c) => (
              <Button key={c} type="button" size="sm" variant="outline" onClick={() => push(c)}>
                {c}
              </Button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) push(text.trim());
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-full border border-border bg-bg px-4 text-sm"
              placeholder="直接说也行，例如：好点了，药按时吃"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit">发送</Button>
          </form>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        改用表单打卡
      </Button>
    </section>
  );
}
