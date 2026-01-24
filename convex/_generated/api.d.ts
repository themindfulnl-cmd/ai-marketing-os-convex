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
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as googleTrends from "../googleTrends.js";
import type * as imagen from "../imagen.js";
import type * as mutations from "../mutations.js";
import type * as planner from "../planner.js";
import type * as queries from "../queries.js";
import type * as weeklyPlanner from "../weeklyPlanner.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  canva: typeof canva;
  cleanup: typeof cleanup;
  crons: typeof crons;
  googleTrends: typeof googleTrends;
  imagen: typeof imagen;
  mutations: typeof mutations;
  planner: typeof planner;
  queries: typeof queries;
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
