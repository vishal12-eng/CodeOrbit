import { motion } from 'framer-motion';
import { Code2, Cloud, Zap, Shield, Sparkles, Brain, Terminal, GitBranch, Globe, Mic, Rocket, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/layout/ThemeToggle';
import PageTransition from '@/components/layout/PageTransition';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Development',
    description: 'Chat, edit code, and build entire features with advanced AI assistance.',
  },
  {
    icon: Code2,
    title: 'Monaco Editor',
    description: 'VS Code-powered editing with syntax highlighting and IntelliSense.',
  },
  {
    icon: Terminal,
    title: 'Integrated Terminal',
    description: 'Full terminal access with command history and npm support.',
  },
  {
    icon: Globe,
    title: 'Live Web Preview',
    description: 'See your changes instantly with responsive device preview.',
  },
  {
    icon: GitBranch,
    title: 'Git Integration',
    description: 'Built-in version control with AI-generated commit messages.',
  },
  {
    icon: Mic,
    title: 'Voice & Multimodal',
    description: 'Speak your code or upload images for AI-powered design-to-code.',
  },
  {
    icon: Cloud,
    title: 'Cloud Execution',
    description: 'Run your code in secure cloud containers with one-click deploy.',
  },
  {
    icon: Sparkles,
    title: 'Builder Mode',
    description: 'Plan, generate, and apply multi-file changes with AI agents.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
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
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/dashboard">
            <Button data-testid="button-dashboard">Dashboard</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative px-6 py-24 md:py-32 overflow-hidden bg-[#111114] dark:bg-background">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-white/90">NovaCode IDE Pro</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
                Build Faster with{' '}
                <span className="text-primary">AI-Powered</span>{' '}
                Cloud Development
              </h1>
              <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
                The ultimate cloud development environment combining AI assistance, 
                instant execution, and seamless deployment. Code smarter, ship faster.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link href="/dashboard">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="lg" className="gap-2 rounded-full" data-testid="button-open-dashboard">
                      <Zap className="h-4 w-4" />
                      Start Building
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/insights">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="lg" variant="outline" className="gap-2 rounded-full bg-white/5 border-white/20 text-white backdrop-blur-sm" data-testid="button-learn-more">
                      Learn More
                      <ArrowRight className="h-4 w-4" />
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

        <section className="relative px-6 py-24 overflow-hidden bg-[#111114] dark:bg-background">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl md:text-3xl font-semibold text-white">
                Ready to start coding?
              </h2>
              <p className="mt-4 text-white/70">
                Sign up for free and launch your first project in seconds.
              </p>
              <div className="mt-8">
                <Link href="/dashboard">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-block"
                  >
                    <Button size="lg" className="rounded-full gap-2" data-testid="button-go-to-dashboard">
                      <Rocket className="h-4 w-4" />
                      Get Started Free
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 border-t bg-[#111114] dark:bg-background">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/insights">
              <Button variant="ghost" size="sm" className="text-white/70">Compare IDEs</Button>
            </Link>
            <p className="text-sm text-white/50">
              Built for developers who love to code.
            </p>
          </div>
        </div>
      </footer>
    </PageTransition>
  );
}
