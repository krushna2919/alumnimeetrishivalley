/**
 * HeroSection.tsx - Landing Page Hero Banner
 * 
 * A visually striking hero section that serves as the first impression for visitors.
 * Features animated elements using Framer Motion for a polished, modern feel.
 * 
 * Design Elements:
 * - Gradient background (gradient-hero class from CSS)
 * - Decorative blur circles for depth
 * - Animated entrance for text and CTA button
 * - Smooth wave transition to the next section
 * 
 * Accessibility:
 * - Semantic heading hierarchy (h1, h2)
 * - Sufficient color contrast for readability
 * - Link to #register section for easy navigation
 */

import { motion } from "framer-motion";

/**
 * HeroSection Component
 * 
 * Renders the hero banner with event branding, dates, and a call-to-action
 * button that scrolls to the registration form.
 * 
 * Animation Sequence:
 * 1. Text fades in and slides up (duration: 0.8s)
 * 2. CTA button appears with slight delay (delay: 0.4s)
 * 
 * @returns Hero section JSX with animations
 */
const HeroSection = () => {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center gradient-hero overflow-hidden">
      {/* Decorative background elements - creates visual depth */}
      <div className="absolute inset-0 opacity-10">
        {/* Top-left blur circle */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary-foreground blur-3xl" />
        {/* Bottom-right blur circle - larger for balance */}
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground blur-3xl" />
      </div>
      
      {/* Main content container */}
      <div className="container relative z-10 text-center px-4 py-20">
        <motion.div
          // Entrance animation: fade in and slide up
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Subtitle - Celebrating milestone */}
          <p className="text-primary-foreground/80 font-sans uppercase tracking-[0.3em] text-sm">
            Celebrating 100 Years
          </p>
          
          {/* Main title - School name */}
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground leading-tight">
            Rishi Valley School
          </h1>
          
          {/* Event name */}
          <h2 className="font-serif text-2xl md:text-4xl text-primary-foreground/90 font-medium">
            Alumni Meet 2026
          </h2>
          
          {/* Event details and description */}
          <div className="flex flex-col items-center gap-4 pt-4">
            {/* Date badge with glassmorphism effect */}
            <div className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm px-6 py-3 rounded-full border border-primary-foreground/20">
              <span className="text-primary-foreground font-semibold text-lg">
                30 & 31 October 2026
              </span>
            </div>
            
            {/* Event description */}
            <p className="text-primary-foreground/70 max-w-2xl text-lg leading-relaxed">
              Much has happened since we last met in 2017. This is a chance to relive the past 
              and see how things have changed on campus.
            </p>
          </div>

          {/* Call-to-action button with staggered animation */}
          <motion.a
            href="#register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="inline-block mt-8 bg-primary-foreground text-secondary font-semibold px-10 py-4 rounded-full shadow-elevated hover:shadow-card transition-all duration-300 hover:scale-105"
          >
            Proceed to Registration
          </motion.a>
        </motion.div>
      </div>
      
      {/* Bottom wave SVG - creates smooth transition to next section */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto">
          <path
            fill="hsl(var(--background))"
            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
