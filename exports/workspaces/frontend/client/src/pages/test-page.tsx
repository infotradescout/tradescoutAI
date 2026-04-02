import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const TestPage = memo(function TestPage() {
  return (
    <div className="text-foreground">
      <div>
        <h1 className="text-3xl font-bold mb-8 text-primary">Test Page</h1>

        {/* Component Testing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Component Testing</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary">Button Tests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Button>Primary Button</Button>
                  <Button variant="outline">Secondary Button</Button>
                  <Button disabled>Disabled Style</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-primary">Form Elements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="text" placeholder="Text input test" />
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Option 1</SelectItem>
                    <SelectItem value="2">Option 2</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Textarea test" rows={3} />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-primary p-4 rounded text-center">
              <div className="text-primary-foreground font-semibold">Primary</div>
              <div className="text-primary-foreground/80 text-sm">var(--primary)</div>
            </div>
            <div className="bg-secondary p-4 rounded text-center">
              <div className="text-secondary-foreground font-semibold">Secondary</div>
              <div className="text-secondary-foreground/80 text-sm">var(--secondary)</div>
            </div>
            <div className="bg-background border border-border p-4 rounded text-center">
              <div className="text-foreground font-semibold">Background</div>
              <div className="text-muted-foreground text-sm">var(--background)</div>
            </div>
            <div className="bg-card p-4 rounded text-center">
              <div className="text-card-foreground font-semibold">Card</div>
              <div className="text-muted-foreground text-sm">var(--card)</div>
            </div>
          </div>
        </section>

        {/* API Testing */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">API Testing</h2>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-primary">Available Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm font-mono">
                <div className="text-green-500">GET /api/health - Health check</div>
                <div className="text-blue-500">GET /api/auth/user - User authentication</div>
                <div className="text-blue-500">GET /api/contractors - Contractor listings</div>
                <div className="text-blue-500">GET /api/daily-deals - Daily contractor deals</div>
                <div className="text-blue-500">GET /api/stats - Platform statistics</div>
              </div>
              <Button className="mt-4">Test API Connection</Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
});

export default TestPage;
