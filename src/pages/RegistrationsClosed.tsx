import { motion } from "framer-motion";

const RegistrationsClosed = () => {
  return (
    <main className="min-h-screen flex items-center justify-center gradient-hero relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary-foreground blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground blur-3xl" />
      </div>

      <div className="container relative z-10 text-center px-6 py-20 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <p className="text-primary-foreground/80 font-sans uppercase tracking-[0.3em] text-sm">
            Celebrating 100 Years
          </p>

          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight">
            Rishi Valley School
          </h1>

          <h2 className="font-serif text-xl md:text-3xl text-primary-foreground/90 font-medium">
            Alumni Meet 2026
          </h2>

          <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl border border-primary-foreground/20 p-8 md:p-10 space-y-5">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/15 px-5 py-2 rounded-full">
              <span className="text-primary-foreground font-semibold text-lg">
                Registrations Closed
              </span>
            </div>

            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Thank you for your overwhelming interest in the Rishi Valley Alumni Meet 2026. 
              Registrations are now closed.
            </p>

            <p className="text-primary-foreground/70 text-base leading-relaxed">
              We look forward to seeing you at the next alumni meet. 
              Stay tuned for future announcements!
            </p>
          </div>

          <div className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm px-6 py-3 rounded-full border border-primary-foreground/20">
            <span className="text-primary-foreground font-semibold text-lg">
              30 & 31 October 2026
            </span>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default RegistrationsClosed;
