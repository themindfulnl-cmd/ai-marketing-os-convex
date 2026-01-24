"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-5xl font-bold mb-3">@themindfulnl</h1>
        <h2 className="text-2xl text-muted-foreground mb-2">Marketing Operating System</h2>
        <p className="text-muted-foreground">
          Your AI Marketing Manager • Turn 1 topic → Content for ALL platforms → Drive registrations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Planner */}
        <Link href="/planner">
          <Card className="cursor-pointer hover:border-primary transition-colors h-full">
            <CardHeader>
              <div className="text-4xl mb-2">📅</div>
              <CardTitle>Weekly Planner</CardTitle>
              <CardDescription>
                AI suggests viral topics → Generate complete strategy for Instagram, Blog, Etsy,
                Affiliates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Start Weekly Planning</Button>
            </CardContent>
          </Card>
        </Link>

        {/* Lead Generation */}
        <Card className="bg-muted/50">
          <CardHeader>
            <div className="text-4xl mb-2">🎓</div>
            <CardTitle>Yoga Class Registrations</CardTitle>
            <CardDescription>Track leads, manage signups, view conversion funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card className="bg-muted/50">
          <CardHeader>
            <div className="text-4xl mb-2">📊</div>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>Instagram growth, revenue tracking, best performing content</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        {/* Canva Designs */}
        <Card className="bg-muted/50">
          <CardHeader>
            <div className="text-4xl mb-2">🎨</div>
            <CardTitle>Canva Automation</CardTitle>
            <CardDescription>Auto-fill templates, batch design creation, download links</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Impact This Week</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold">124</div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </div>
          <div>
            <div className="text-3xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Content Created</div>
          </div>
          <div>
            <div className="text-3xl font-bold">€0</div>
            <div className="text-sm text-muted-foreground">Revenue MTD</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
