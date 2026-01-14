import { motion } from "framer-motion";

const HeroSection = () => {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center gradient-hero overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary-foreground blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground blur-3xl" />
      </div>
      
      <div className="container relative z-10 text-center px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <p className="text-primary-foreground/80 font-sans uppercase tracking-[0.3em] text-sm">
            Celebrating 100 Years
          </p>
          
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground leading-tight">
            Rishi Valley School
          </h1>
          
          <h2 className="font-serif text-2xl md:text-4xl text-primary-foreground/90 font-medium">
            Alumni Meet 2026
          </h2>
          
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm px-6 py-3 rounded-full border border-primary-foreground/20">
              <span className="text-primary-foreground font-semibold text-lg">
                30 & 31 October 2026
              </span>
            </div>
            
            <p className="text-primary-foreground/70 max-w-2xl text-lg leading-relaxed">
              Much has happened since we last met in 2017. This is a chance to relive the past 
              and see how things have changed on campus.
            </p>
          </div>

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
      
      {/* Bottom wave */}
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
