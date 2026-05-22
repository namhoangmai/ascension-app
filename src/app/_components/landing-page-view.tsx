"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  Activity,
  ArrowRight,
  Dumbbell,
  Flame,
  LineChart,
  Scale,
  Utensils,
  Zap
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { Button } from "@/components/ui/button";

interface LandingPageViewProps {
  primaryHref: Route;
  primaryLabel: string;
  secondaryHref: Route;
  secondaryLabel: string;
  navActionLabel: string;
}

const dayPlan = [
  { label: "Calories", value: "2,240", detail: "demo target" },
  { label: "Protein", value: "178 g", detail: "demo target" },
  { label: "Training", value: "Upper", detail: "demo session" }
];

const macroBars = [
  { className: "landing-bar--protein", value: 0.72 },
  { className: "landing-bar--carbs", value: 0.58 },
  { className: "landing-bar--fat", value: 0.44 }
];

const loggingLanes = [
  {
    icon: Utensils,
    title: "Meals stay readable",
    copy: "Log breakfast, lunch, dinner, and snacks without losing the macro picture.",
    value: "Food log"
  },
  {
    icon: Dumbbell,
    title: "Sets stay attached",
    copy: "Keep exercise history beside the workout instead of spread across notes.",
    value: "Training log"
  },
  {
    icon: Scale,
    title: "Body trends stay separate",
    copy: "Track measurements and weight without mixing them into calorie decisions.",
    value: "Body log"
  }
];

const workoutRows = [
  { lift: "Incline press", work: "4 x 8", load: "72.5 kg" },
  { lift: "Chest-supported row", work: "3 x 10", load: "64 kg" },
  { lift: "Split squat", work: "3 x 8", load: "28 kg" }
];

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const settleTransition = { duration: 0.42, ease: easeOut };

const heroAssembly: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06
    }
  }
};

const settleItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: settleTransition }
};

export function LandingPageView({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  navActionLabel
}: LandingPageViewProps) {
  const reduceMotion = useReducedMotion();
  const assemblyProps = reduceMotion ? {} : ({ initial: "initial", animate: "animate" } as const);
  const interactionProps = reduceMotion
    ? {}
    : ({ whileHover: { y: -1 }, whileTap: { y: 1 } } as const);
  const progressTransition = {
    duration: reduceMotion ? 0 : 0.74,
    ease: easeOut,
    delay: reduceMotion ? 0 : 0.28
  };
  const barTransition = (index: number) => ({
    duration: reduceMotion ? 0 : 0.64,
    ease: easeOut,
    delay: reduceMotion ? 0 : 0.34 + index * 0.06
  });

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary">
        <Link href="/" className="landing-wordmark" aria-label="Ascension home">
          Ascension
        </Link>
        <div className="landing-nav__links" aria-label="Page sections">
          <a href="#nutrition">Nutrition</a>
          <a href="#training">Training</a>
          <a href="#body">Body</a>
        </div>
        <Link href={secondaryHref} className="landing-nav__action">
          {navActionLabel}
        </Link>
      </nav>

      <motion.section
        className="landing-hero"
        aria-labelledby="landing-title"
        variants={heroAssembly}
        {...assemblyProps}
      >
        <motion.div className="landing-hero__copy" variants={settleItem}>
          <p className="landing-kicker">Daily intake · training load · body trend</p>
          <h1 id="landing-title">Food, training, body. One log.</h1>
          <p className="landing-hero__lede">
            Ascension gives lifters one quiet place to plan meals, record workouts, and review body
            progress without turning health data into a spreadsheet chore.
          </p>
          <div className="landing-actions" aria-label="Account actions">
            <Button asChild size="lg" className="landing-button landing-button--primary">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="landing-button">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="landing-workbench"
          aria-label="Ascension tracking preview"
          variants={settleItem}
        >
          <div className="landing-workbench__summary">
            <div>
              <span>Today</span>
              <strong>Demo day</strong>
            </div>
            <div className="landing-score" aria-label="Daily plan completion preview">
              <svg className="landing-score__ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle className="landing-score__track" cx="22" cy="22" r="18" />
                <motion.circle
                  className="landing-score__value"
                  cx="22"
                  cy="22"
                  r="18"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 0.74 }}
                  transition={progressTransition}
                />
              </svg>
              <span>74</span>
            </div>
          </div>
          <div className="landing-plan-grid">
            {dayPlan.map((item) => (
              <motion.div key={item.label} className="landing-plan-card" {...interactionProps}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </motion.div>
            ))}
          </div>
          <div className="landing-macro-panel">
            <div className="landing-panel-head">
              <span>Macros</span>
              <strong>Remaining</strong>
            </div>
            <div className="landing-bars" aria-hidden="true">
              {macroBars.map((bar, index) => (
                <span key={bar.className} className={`landing-bar ${bar.className}`}>
                  <motion.span
                    className="landing-bar__fill"
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: bar.value }}
                    transition={barTransition(index)}
                  />
                </span>
              ))}
            </div>
          </div>
          <div className="landing-workout-panel">
            <div className="landing-panel-head">
              <span>Workout</span>
              <strong>Upper session</strong>
            </div>
            <div className="landing-workout-list">
              {workoutRows.map((row) => (
                <motion.div key={row.lift} className="landing-workout-row" {...interactionProps}>
                  <span>{row.lift}</span>
                  <small>{row.work}</small>
                  <strong>{row.load}</strong>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.section>

      <section id="nutrition" className="landing-section landing-section--plan">
        <div className="landing-section__head">
          <h2>Plan the day before the day gets loud.</h2>
          <p>
            Calories and macros sit beside the meal list, so the next food entry updates context
            instead of becoming another isolated number.
          </p>
        </div>
        <div className="landing-ledger" aria-label="Nutrition planning preview">
          <div className="landing-ledger__row landing-ledger__row--head">
            <span>Meal</span>
            <span>Protein</span>
            <span>Calories</span>
          </div>
          <div className="landing-ledger__row">
            <span>Greek yogurt bowl</span>
            <span>42 g</span>
            <span>510</span>
          </div>
          <div className="landing-ledger__row">
            <span>Chicken rice plate</span>
            <span>58 g</span>
            <span>740</span>
          </div>
          <div className="landing-ledger__row">
            <span>Pre-lift snack</span>
            <span>18 g</span>
            <span>260</span>
          </div>
        </div>
      </section>

      <section id="training" className="landing-section landing-section--lanes">
        <div className="landing-section__head">
          <h2>Three logs, one operating rhythm.</h2>
          <p>
            The homepage story follows the actual product surfaces: food entries, lifting work, and
            body data that can be reviewed together without being collapsed into one chart.
          </p>
        </div>
        <div className="landing-lanes">
          {loggingLanes.map((lane) => (
            <motion.article key={lane.title} className="landing-lane" {...interactionProps}>
              <div className="landing-lane__icon">
                <lane.icon aria-hidden="true" />
              </div>
              <div>
                <span>{lane.value}</span>
                <h3>{lane.title}</h3>
                <p>{lane.copy}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="body" className="landing-proof" aria-labelledby="proof-title">
        <div className="landing-proof__copy">
          <h2 id="proof-title">Review progress without chasing noise.</h2>
          <p>
            Ascension separates intake, effort, and body trend so weekly review is a decision
            surface, not a blame surface.
          </p>
        </div>
        <div className="landing-proof__grid">
          <motion.div className="landing-signal" {...interactionProps}>
            <Activity aria-hidden="true" />
            <span>Energy</span>
            <strong>steady</strong>
          </motion.div>
          <motion.div className="landing-signal" {...interactionProps}>
            <Flame aria-hidden="true" />
            <span>Intake</span>
            <strong>planned</strong>
          </motion.div>
          <motion.div className="landing-signal" {...interactionProps}>
            <LineChart aria-hidden="true" />
            <span>Trend</span>
            <strong>visible</strong>
          </motion.div>
          <motion.div className="landing-signal landing-signal--accent" {...interactionProps}>
            <Zap aria-hidden="true" />
            <span>Next action</span>
            <strong>log today</strong>
          </motion.div>
        </div>
      </section>

      <aside className="landing-sticky-cta" aria-label="Start using Ascension">
        <span>Track the next meal and the next set in the same place.</span>
        <Link href={primaryHref}>
          {primaryHref === "/dashboard" ? "Open dashboard" : "Create account"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </aside>

      <footer className="landing-footer">
        <p>Make the log calm enough to use every day.</p>
        <div className="landing-footer__meta">
          <Link href="/" className="landing-wordmark">
            Ascension
          </Link>
          <span>Nutrition · workouts · body progress</span>
        </div>
      </footer>
    </main>
  );
}
