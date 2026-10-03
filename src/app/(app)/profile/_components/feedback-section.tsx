"use client";

import type { FeedbackCategory } from "@prisma/client";
import { useActionState, useEffect, useState } from "react";

import { submitFeedbackAction } from "@/features/feedback/actions";
import type { FeedbackActionState } from "@/features/feedback/server";
import { feedbackCategoryLabels } from "@/features/feedback/types";

import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

const initialState: FeedbackActionState = { status: "idle" };
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 10;

const categoryOptions = Object.entries(feedbackCategoryLabels) as [FeedbackCategory, string][];

export function FeedbackSection() {
  const [state, action] = useActionState(submitFeedbackAction, initialState);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      setMessage("");
    }
  }, [state]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-sm font-medium text-muted-foreground">Feedback & Recommendations</p>
      <h2 className="text-title mt-2">Tell us what would make Ascension better</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This goes straight to the Ascension team to help shape what gets built next.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Category</span>
          <select
            name="category"
            defaultValue="FEEDBACK"
            className="h-12 w-full rounded-md border border-border bg-muted px-3 text-foreground outline-none transition-shadow focus:border-foreground focus:ring-2 focus:ring-ring"
          >
            {categoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.category ? (
            <FormMessage tone="error">{state.fieldErrors.category[0]}</FormMessage>
          ) : null}
        </label>
        <label className="block space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Message</span>
            <span className="text-xs text-muted-foreground">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
          <textarea
            name="message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH));
            }}
            minLength={MIN_MESSAGE_LENGTH}
            maxLength={MAX_MESSAGE_LENGTH}
            required
            placeholder="Share what's working, what's not, or what you'd like to see next..."
            className="min-h-32 w-full rounded-md border border-border bg-muted px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {state.fieldErrors?.message ? (
            <FormMessage tone="error">{state.fieldErrors.message[0]}</FormMessage>
          ) : null}
        </label>
        {state.message ? (
          <FormMessage tone={state.status === "success" ? "success" : "error"}>
            {state.message}
          </FormMessage>
        ) : null}
        <SubmitButton>Send feedback</SubmitButton>
      </form>
    </section>
  );
}
