import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Textarea,
  Badge,
  StatusBadge,
  CountBadge,
  Alert,
  AlertDescription,
  Spinner,
  LoadingOverlay,
  Skeleton,
} from '@/components/ui';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Plus,
  Download,
  Upload,
  Settings,
  User,
  Mail,
} from 'lucide-react';

export default function DesignSystemShowcase() {
  const [showLoading, setShowLoading] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            TAAXDOG Design System
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Consistent, accessible, and beautiful UI components
          </p>
        </div>

        {/* Colors */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Colors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-full h-24 bg-blue-600 rounded-lg mb-2"></div>
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-gray-500">#2563EB</p>
            </div>
            <div className="text-center">
              <div className="w-full h-24 bg-green-600 rounded-lg mb-2"></div>
              <p className="text-sm font-medium">Success</p>
              <p className="text-xs text-gray-500">#16A34A</p>
            </div>
            <div className="text-center">
              <div className="w-full h-24 bg-red-600 rounded-lg mb-2"></div>
              <p className="text-sm font-medium">Danger</p>
              <p className="text-xs text-gray-500">#DC2626</p>
            </div>
            <div className="text-center">
              <div className="w-full h-24 bg-amber-600 rounded-lg mb-2"></div>
              <p className="text-sm font-medium">Warning</p>
              <p className="text-xs text-gray-500">#D97706</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Typography</h2>
          <Card padding>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold">Heading 1</h1>
              <h2 className="text-3xl font-semibold">Heading 2</h2>
              <h3 className="text-2xl font-semibold">Heading 3</h3>
              <h4 className="text-xl font-medium">Heading 4</h4>
              <p className="text-base">Body text - Regular paragraph text for content</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Small text - Secondary information
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Extra small text - Metadata
              </p>
            </div>
          </Card>
        </section>

        {/* Buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Buttons</h2>

          <div className="space-y-6">
            <Card padding>
              <h3 className="text-lg font-semibold mb-4">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="success">Success</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="warning">Warning</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </Card>

            <Card padding>
              <h3 className="text-lg font-semibold mb-4">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">Extra Small</Button>
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </Card>

            <Card padding>
              <h3 className="text-lg font-semibold mb-4">States & Icons</h3>
              <div className="flex flex-wrap gap-3">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button leftIcon={<Plus className="w-4 h-4" />}>With Icon</Button>
                <Button rightIcon={<Download className="w-4 h-4" />}>Download</Button>
                <Button fullWidth>Full Width</Button>
              </div>
            </Card>
          </div>
        </section>

        {/* Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <CardDescription>This is a card description</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card content goes here. You can put any content inside a card.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
                <CardDescription>With stronger shadow</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This card has a more prominent shadow for emphasis.</p>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader>
                <CardTitle>Outlined Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card uses a border instead of shadow.</p>
              </CardContent>
            </Card>

            <Card variant="filled">
              <CardHeader>
                <CardTitle>Filled Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This card has a subtle background color.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Forms */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Form Elements
          </h2>
          <Card padding>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="john@example.com"
                  leftIcon={<Mail className="w-5 h-5" />}
                />

                <Input
                  label="Username"
                  placeholder="Enter username"
                  hint="Must be unique"
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  error="Password must be at least 8 characters"
                />
              </div>

              <div className="space-y-4">
                <Textarea
                  label="Description"
                  placeholder="Tell us about yourself..."
                  rows={4}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Input Sizes</label>
                  <Input
                    size="sm"
                    placeholder="Small input"
                  />
                  <Input
                    size="md"
                    placeholder="Medium input"
                  />
                  <Input
                    size="lg"
                    placeholder="Large input"
                  />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Badges */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Badges</h2>
          <Card padding>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge size="xs">Extra Small</Badge>
                <Badge size="sm">Small</Badge>
                <Badge size="md">Medium</Badge>
                <Badge size="lg">Large</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge status="online">Online</StatusBadge>
                <StatusBadge status="offline">Offline</StatusBadge>
                <StatusBadge status="busy">Busy</StatusBadge>
                <StatusBadge status="away">Away</StatusBadge>
              </div>

              <div className="flex flex-wrap gap-2">
                <CountBadge count={5} />
                <CountBadge count={42} />
                <CountBadge count={128} />
                <Badge onRemove={() => {}}>Removable</Badge>
              </div>
            </div>
          </Card>
        </section>

        {/* Alerts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Alerts</h2>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>This is a default alert message.</AlertDescription>
            </Alert>

            <Alert
              variant="success"
              title="Success!"
            >
              <AlertDescription>Your changes have been saved successfully.</AlertDescription>
            </Alert>

            <Alert
              variant="danger"
              title="Error"
            >
              <AlertDescription>There was an error processing your request.</AlertDescription>
            </Alert>

            <Alert variant="warning">
              <AlertDescription>Please review your information before continuing.</AlertDescription>
            </Alert>

            <Alert
              variant="info"
              title="Did you know?"
            >
              <AlertDescription>
                You can dismiss alerts by adding the dismissible prop.
              </AlertDescription>
            </Alert>

            {!dismissedAlert && (
              <Alert
                variant="info"
                dismissible
                onDismiss={() => setDismissedAlert(true)}
              >
                <AlertDescription>This alert can be dismissed. Try it!</AlertDescription>
              </Alert>
            )}
          </div>
        </section>

        {/* Loading States */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Loading States
          </h2>
          <Card padding>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Spinners</h3>
                <div className="flex items-center gap-4">
                  <Spinner size="xs" />
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                  <Spinner size="xl" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Skeleton Loaders</h3>
                <div className="space-y-3">
                  <Skeleton variant="text" />
                  <Skeleton
                    variant="text"
                    width="60%"
                  />
                  <Skeleton
                    variant="rectangular"
                    height={100}
                  />
                  <div className="flex gap-3">
                    <Skeleton variant="circular" />
                    <div className="flex-1 space-y-2">
                      <Skeleton variant="text" />
                      <Skeleton
                        variant="text"
                        width="80%"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Loading Overlay</h3>
                <Button onClick={() => setShowLoading(true)}>Show Loading Overlay</Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Spacing Guide */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Spacing System
          </h2>
          <Card padding>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((size) => (
                <div
                  key={size}
                  className="flex items-center gap-4"
                >
                  <span className="text-sm font-mono w-16">p-{size}</span>
                  <div
                    className={`bg-blue-500 h-6 p-${size}`}
                    style={{ width: `${size * 4}px` }}
                  ></div>
                  <span className="text-sm text-gray-500">{size * 4}px</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <LoadingOverlay
        show={showLoading}
        message="Loading..."
        fullScreen
      />

      {showLoading && (
        <div className="fixed bottom-4 right-4">
          <Button
            variant="secondary"
            onClick={() => setShowLoading(false)}
          >
            Close Loading
          </Button>
        </div>
      )}
    </div>
  );
}
