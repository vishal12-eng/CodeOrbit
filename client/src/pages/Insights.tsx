import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowLeft,
  Sparkles,
  Cloud,
  Zap,
  Brain,
  Code,
  Terminal,
  Globe,
  Layers,
  Check,
  X,
  Minus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import PageTransition from "@/components/layout/PageTransition";

interface IDE {
  name: string;
  tagline: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  icon: React.ReactNode;
  color: string;
}

const ides: IDE[] = [
  {
    name: "Cursor",
    tagline: "AI-First Code Editor",
    description:
      "Cursor pioneered the AI-integrated code editor experience, building on the familiar VS Code foundation while adding deep AI capabilities. It excels at understanding your entire codebase through continuous embeddings, providing context-aware suggestions that feel natural and accurate.",
    strengths: [
      "Deep project context understanding through embeddings",
      "Natural language code editing with precise control",
      "Familiar VS Code interface reduces learning curve",
      "Excellent multi-file refactoring capabilities",
      "Strong privacy controls for enterprise users",
    ],
    weaknesses: [
      "Requires local installation",
      "Limited cloud execution capabilities",
      "No built-in deployment or hosting",
      "Can be resource-intensive on older machines",
    ],
    bestFor: [
      "Professional developers wanting AI assistance",
      "Large codebase navigation and refactoring",
      "Teams already comfortable with VS Code",
    ],
    icon: <Brain className="h-8 w-8" />,
    color: "from-purple-500 to-indigo-600",
  },
  {
    name: "Replit",
    tagline: "Cloud Development Platform",
    description:
      "Replit transformed how developers think about development environments by moving everything to the cloud. With instant containers, built-in databases, and one-click deployments, it removes the friction between writing code and shipping products.",
    strengths: [
      "Zero-setup cloud development environment",
      "Built-in PostgreSQL databases and key-value stores",
      "One-click deployments with automatic SSL",
      "Collaborative multiplayer coding",
      "Extensive template library for quick starts",
    ],
    weaknesses: [
      "Performance depends on internet connection",
      "Limited customization compared to local IDEs",
      "Some advanced debugging features missing",
      "Resource limits on free tier",
    ],
    bestFor: [
      "Beginners learning to code",
      "Rapid prototyping and hackathons",
      "Teams needing instant collaboration",
      "Projects requiring quick deployment",
    ],
    icon: <Cloud className="h-8 w-8" />,
    color: "from-orange-500 to-red-600",
  },
  {
    name: "Bolt.new",
    tagline: "Instant App Builder",
    description:
      "Bolt.new revolutionized the concept of prompt-to-application development. Using WebContainer technology, it runs a complete development environment directly in your browser, enabling instant creation of full-stack applications from natural language descriptions.",
    strengths: [
      "Create complete apps from a single prompt",
      "Runs entirely in browser - no backend needed",
      "Instant preview and iteration",
      "Excellent for UI/UX prototyping",
      "No installation or setup required",
    ],
    weaknesses: [
      "Limited to web technologies only",
      "Cannot run server-side code natively",
      "Less control over individual files",
      "Browser memory constraints for large projects",
    ],
    bestFor: [
      "Quick prototypes and MVPs",
      "Frontend developers and designers",
      "Non-technical users building simple apps",
      "Rapid ideation and exploration",
    ],
    icon: <Zap className="h-8 w-8" />,
    color: "from-yellow-500 to-orange-600",
  },
  {
    name: "Trae IDE",
    tagline: "AI Agent Development",
    description:
      "Trae IDE (by ByteDance) brought the concept of agentic AI development to the mainstream. With its Builder Mode and multi-step task execution, it can plan, generate, and apply changes across your entire project while maintaining a clear audit trail.",
    strengths: [
      "Agentic multi-step task execution",
      "Visual plan preview before applying changes",
      "Multimodal input (images, screenshots)",
      "Deep VS Code compatibility",
      "Voice input for hands-free coding",
    ],
    weaknesses: [
      "Requires local installation",
      "Newer tool with evolving features",
      "Limited cloud integration",
      "Fewer community extensions than Cursor",
    ],
    bestFor: [
      "Developers wanting AI to handle complex tasks",
      "Visual-first workflows with design input",
      "Those who prefer plan-review-apply workflows",
    ],
    icon: <Code className="h-8 w-8" />,
    color: "from-cyan-500 to-blue-600",
  },
];

const featureComparison = [
  { feature: "Cloud Execution", nova: true, cursor: false, replit: true, bolt: "partial", trae: false },
  { feature: "AI Chat", nova: true, cursor: true, replit: true, bolt: true, trae: true },
  { feature: "AI Code Edit", nova: true, cursor: true, replit: true, bolt: true, trae: true },
  { feature: "Builder Mode", nova: true, cursor: false, replit: false, bolt: true, trae: true },
  { feature: "Multi-Model Support", nova: true, cursor: true, replit: false, bolt: false, trae: true },
  { feature: "Voice Input", nova: true, cursor: false, replit: false, bolt: false, trae: true },
  { feature: "Image Analysis", nova: true, cursor: true, replit: false, bolt: true, trae: true },
  { feature: "Git Integration", nova: true, cursor: true, replit: true, bolt: false, trae: true },
  { feature: "Terminal", nova: true, cursor: true, replit: true, bolt: "partial", trae: true },
  { feature: "Web Preview", nova: true, cursor: false, replit: true, bolt: true, trae: false },
  { feature: "One-Click Deploy", nova: true, cursor: false, replit: true, bolt: false, trae: false },
  { feature: "Database Integration", nova: true, cursor: false, replit: true, bolt: false, trae: false },
  { feature: "Collaborative Editing", nova: true, cursor: false, replit: true, bolt: false, trae: false },
  { feature: "Extensions", nova: true, cursor: true, replit: false, bolt: false, trae: true },
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

function FeatureIcon({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-green-500" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-red-400" />;
  }
  return <Minus className="h-5 w-5 text-yellow-500" />;
}

export default function Insights() {
  return (
    <PageTransition className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Logo />
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Deep Dive
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            The AI IDE Landscape
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A comprehensive analysis of modern AI-powered development environments
            and how NovaCode brings together the best of all worlds.
          </p>
        </motion.div>

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            IDE Profiles
          </h2>
          <div className="grid gap-8">
            {ides.map((ide, index) => (
              <motion.div key={ide.name} variants={itemVariants}>
                <Card className="overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${ide.color}`} />
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${ide.color} text-white`}>
                          {ide.icon}
                        </div>
                        <div>
                          <CardTitle className="text-2xl">{ide.name}</CardTitle>
                          <p className="text-muted-foreground">{ide.tagline}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-6">{ide.description}</p>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {ide.strengths.map((strength) => (
                            <li key={strength} className="text-sm text-muted-foreground">
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                          <X className="h-4 w-4" />
                          Limitations
                        </h4>
                        <ul className="space-y-1">
                          {ide.weaknesses.map((weakness) => (
                            <li key={weakness} className="text-sm text-muted-foreground">
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Best For
                        </h4>
                        <ul className="space-y-1">
                          {ide.bestFor.map((use) => (
                            <li key={use} className="text-sm text-muted-foreground">
                              {use}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h2 className="text-2xl font-semibold mb-8 flex items-center gap-2">
            <Terminal className="h-6 w-6 text-primary" />
            Feature Comparison
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium">Feature</th>
                      <th className="text-center p-4 font-medium">
                        <span className="text-primary">NovaCode</span>
                      </th>
                      <th className="text-center p-4 font-medium">Cursor</th>
                      <th className="text-center p-4 font-medium">Replit</th>
                      <th className="text-center p-4 font-medium">Bolt.new</th>
                      <th className="text-center p-4 font-medium">Trae</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureComparison.map((row, index) => (
                      <motion.tr
                        key={row.feature}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 font-medium">{row.feature}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureIcon value={row.nova} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureIcon value={row.cursor} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureIcon value={row.replit} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureIcon value={row.bolt} />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center">
                            <FeatureIcon value={row.trae} />
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <Card className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white">
                  <Sparkles className="h-10 w-10" />
                </div>
              </div>
              <CardTitle className="text-3xl">Why NovaCode?</CardTitle>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                NovaCode brings together the best features from each platform into
                a unified, powerful development experience.
              </p>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <Cloud className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-medium mb-2">Cloud-Native</h4>
                <p className="text-sm text-muted-foreground">
                  Full cloud execution like Replit with instant containers and deployment
                </p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <Brain className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-medium mb-2">Deep AI Context</h4>
                <p className="text-sm text-muted-foreground">
                  Project-wide understanding like Cursor with embeddings and memory
                </p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <Zap className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-medium mb-2">Instant Building</h4>
                <p className="text-sm text-muted-foreground">
                  Prompt-to-app generation like Bolt with live preview
                </p>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-muted/50 text-center"
              >
                <Code className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-medium mb-2">Agentic Workflow</h4>
                <p className="text-sm text-muted-foreground">
                  Multi-step task execution like Trae with plan-review-apply
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/dashboard">
            <Button size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Try NovaCode Now
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </main>

      <footer className="border-t py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>NovaCode IDE - The future of AI-powered development</p>
        </div>
      </footer>
    </PageTransition>
  );
}
