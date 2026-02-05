/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as canva from "../canva.js";
import type * as chat from "../chat.js";
import type * as cleanup from "../cleanup.js";
import type * as contentLab from "../contentLab.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as googleTrends from "../googleTrends.js";
import type * as imagen from "../imagen.js";
import type * as jobHunter from "../jobHunter.js";
import type * as jobs from "../jobs.js";
import type * as linkedin from "../linkedin.js";
import type * as mutations from "../mutations.js";
import type * as planner from "../planner.js";
import type * as queries from "../queries.js";
import type * as resumes from "../resumes.js";
import type * as users from "../users.js";
import type * as weeklyPlanner from "../weeklyPlanner.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  canva: typeof canva;
  chat: typeof chat;
  cleanup: typeof cleanup;
  contentLab: typeof contentLab;
  crons: typeof crons;
  debug: typeof debug;
  googleTrends: typeof googleTrends;
  imagen: typeof imagen;
  jobHunter: typeof jobHunter;
  jobs: typeof jobs;
  linkedin: typeof linkedin;
  mutations: typeof mutations;
  planner: typeof planner;
  queries: typeof queries;
  resumes: typeof resumes;
  users: typeof users;
  weeklyPlanner: typeof weeklyPlanner;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
