// Convex Auth Configuration for Clerk
// This file tells Convex to trust JWTs from Clerk

export default {
    providers: [
        {
            domain: "https://noted-pony-8.clerk.accounts.dev",
            applicationID: "convex",
        },
    ],
};
