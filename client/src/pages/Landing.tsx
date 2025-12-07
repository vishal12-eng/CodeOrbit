import { motion } from 'framer-motion';
import { Code2, Cloud, Play, FolderTree, Zap, Shield } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import PageTransition from '@/components/layout/PageTransition';

const features = [
  {
    icon: Code2,
    title: 'Monaco Editor',
    description: 'VS Code-powered editing with syntax highlighting and IntelliSense.',
  },
  {
    icon: Play,
    title: 'Instant Run',
    description: 'Execute your Node.js code instantly with a single click.',
  },
  {
    icon: FolderTree,
    title: 'Multi-File Projects',
    description: 'Organize your code in folders and files, just like a real IDE.',
  },
  {
    icon: Cloud,
    title: 'Cloud Saved',
    description: 'Your projects are automatically saved and synced to the cloud.',
  },
  {
    icon: Zap,
    title: 'Fast & Light',
    description: 'Minimal, blazing-fast interface designed for productivity.',
  },
  {
    icon: Shield,
    title: 'Secure',
    description: 'Your code is private and securely stored in your account.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <PageTransition className="min-h-screen">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" data-testid="button-login">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button data-testid="button-signup">Sign up</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Code in the cloud with{' '}
                <span className="text-primary">CodeOrbit</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                A browser-based mini cloud IDE for students, indie devs, and beginners.
                Write, run, and organize your JavaScript projects directly in your browser.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link href="/signup">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="lg" className="gap-2" data-testid="button-get-started">
                      <Zap className="h-4 w-4" />
                      Get Started Free
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/dashboard">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="lg" variant="outline" data-testid="button-open-dashboard">
                      Open Dashboard
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-16 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-3xl font-semibold">
                Everything you need to code
              </h2>
              <p className="mt-4 text-muted-foreground">
                Powerful features in a simple, beautiful interface.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {features.map((feature) => (
                <motion.div key={feature.title} variants={itemVariants}>
                  <Card className="h-full transition-all duration-200 hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl md:text-3xl font-semibold">
                Ready to start coding?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Sign up for free and launch your first project in seconds.
              </p>
              <div className="mt-8">
                <Link href="/signup">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-block"
                  >
                    <Button size="lg" data-testid="button-create-account">
                      Create Free Account
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">
            Built for developers who love to code.
          </p>
        </div>
      </footer>
    </PageTransition>
  );
}
