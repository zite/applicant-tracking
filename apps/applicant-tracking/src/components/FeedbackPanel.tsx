import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CalendarPlus, Plus, Video } from 'lucide-react';
import { submitScorecard } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Avatar, AvatarStack } from './Avatar';
import { ScheduleInterviewDialog } from './ScheduleInterviewDialog';
import { Rating } from './Rating';
import { dateTimeLabel, recommendationTone } from '../lib/format';
import type { TeamMember } from '../lib/queries';
import type { GetApplicationOutputType } from 'zitejs/api';

type Interview = GetApplicationOutputType['interviews'][number];
type Scorecard = GetApplicationOutputType['scorecards'][number];

const ATTRS = [
  ['technicalSkill', 'Technical skill'],
  ['communication', 'Communication'],
  ['problemSolving', 'Problem solving'],
  ['cultureAdd', 'Culture add'],
] as const;

export function FeedbackPanel({
  interviews,
  scorecards,
  members,
  team,
  applicationId,
  candidateName,
  onSubmitted,
}: {
  interviews: Interview[];
  scorecards: Scorecard[];
  members: Map<string, TeamMember>;
  team: TeamMember[];
  applicationId: string;
  candidateName: string;
  onSubmitted: () => void;
}) {
  const [target, setTarget] = useState<Interview | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState({
    overallRating: 3,
    technicalSkill: 3,
    communication: 3,
    problemSolving: 3,
    cultureAdd: 3,
    recommendation: 'Yes' as 'Strong Yes' | 'Yes' | 'No' | 'Strong No',
    strengths: '',
    concerns: '',
  });

  const save = useMutation({
    mutationFn: () =>
      submitScorecard({
        interviewId: target!.id,
        overallRating: form.overallRating,
        technicalSkill: form.technicalSkill,
        communication: form.communication,
        problemSolving: form.problemSolving,
        cultureAdd: form.cultureAdd,
        recommendation: form.recommendation,
        strengths: form.strengths || undefined,
        concerns: form.concerns || undefined,
      }),
    onSuccess: () => {
      setTarget(null);
      onSubmitted();
      toast.success('Feedback submitted');
    },
    onError: () => toast.error('Could not submit that feedback'),
  });

  const byInterview = new Map<string, Scorecard[]>();
  for (const s of scorecards) {
    if (!s.interviewId) continue;
    byInterview.set(s.interviewId, [...(byInterview.get(s.interviewId) ?? []), s]);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setScheduling(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Schedule interview
        </button>
      </div>

      {interviews.map((iv) => {
        const cards = byInterview.get(iv.id) ?? [];
        const panel = iv.interviewerIds
          .map((id) => members.get(id))
          .filter((m): m is TeamMember => Boolean(m));
        return (
          <div key={iv.id} className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="text-[12.5px] font-medium">{iv.type ?? 'Interview'}</span>
              <span
                className={`rounded border px-1.5 py-px text-[10px] ${
                  iv.status === 'Completed'
                    ? 'border-tone-success/30 bg-tone-success/10 text-tone-success'
                    : iv.status === 'Scheduled'
                      ? 'border-tone-info/30 bg-tone-info/10 text-tone-info'
                      : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {iv.status}
              </span>
              <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {dateTimeLabel(iv.scheduledAt)} · {iv.durationMinutes}m
              </span>
              {iv.meetingLink && (
                <a
                  href={iv.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11.5px] text-primary hover:underline"
                >
                  <Video className="h-3 w-3" /> Join
                </a>
              )}
              <span className="ml-auto flex items-center gap-2">
                {panel.length > 0 && <AvatarStack people={panel} size={18} />}
                <button
                  type="button"
                  onClick={() => setTarget(iv)}
                  className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Feedback
                </button>
              </span>
            </div>

            {cards.length > 0 ? (
              <div className="divide-y divide-border">
                {cards.map((sc) => {
                  const who = sc.interviewerId ? members.get(sc.interviewerId) : undefined;
                  return (
                    <div key={sc.id} className="px-3 py-2.5">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {who && (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={who.name} src={who.avatarUrl} size={18} />
                            <span className="text-[12px] font-medium">{who.name}</span>
                          </span>
                        )}
                        <span
                          className={`text-[12px] font-medium ${recommendationTone(sc.recommendation)}`}
                        >
                          {sc.recommendation}
                        </span>
                        <span className="ml-auto">
                          <Rating value={sc.overallRating} size={12} />
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                        {ATTRS.map(([key, label]) => (
                          <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {label}
                            <Rating value={sc[key]} size={10} />
                          </span>
                        ))}
                      </div>
                      {sc.strengths && (
                        <p className="text-[12.5px] leading-relaxed">
                          <span className="text-tone-success">Strengths. </span>
                          {sc.strengths}
                        </p>
                      )}
                      {sc.concerns && (
                        <p className="mt-1 text-[12.5px] leading-relaxed">
                          <span className="text-tone-warning">Concerns. </span>
                          {sc.concerns}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-muted-foreground">
                No feedback submitted yet.
              </div>
            )}
          </div>
        );
      })}

      {interviews.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-[12.5px] text-muted-foreground">
          No interviews scheduled yet.
        </div>
      )}

      <ScheduleInterviewDialog
        open={scheduling}
        onOpenChange={setScheduling}
        applicationId={applicationId}
        candidateName={candidateName}
        team={team}
        onScheduled={onSubmitted}
      />

      <Dialog open={Boolean(target)} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[14px]">
              Feedback — {target?.type ?? 'Interview'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-[12.5px] font-medium">Overall</span>
              <Rating
                value={form.overallRating}
                size={18}
                onChange={(v) => setForm((f) => ({ ...f, overallRating: Math.max(1, v) }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ATTRS.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5"
                >
                  <span className="text-[11.5px] text-muted-foreground">{label}</span>
                  <Rating
                    value={form[key]}
                    onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-1.5">
              {(['Strong Yes', 'Yes', 'No', 'Strong No'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, recommendation: r }))}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[11.5px] font-medium transition ${
                    form.recommendation === r
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={form.strengths}
              onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))}
              rows={3}
              placeholder="What went well? Be specific."
              className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-2 text-[12.5px] outline-none focus:border-primary/60"
            />
            <textarea
              value={form.concerns}
              onChange={(e) => setForm((f) => ({ ...f, concerns: e.target.value }))}
              rows={3}
              placeholder="What gave you pause?"
              className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-2 text-[12.5px] outline-none focus:border-primary/60"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                {save.isPending ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
