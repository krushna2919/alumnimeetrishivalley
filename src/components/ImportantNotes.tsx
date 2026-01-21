import { motion } from "framer-motion";
import { CalendarCheck, Home, Shirt, Clock, Users } from "lucide-react";

const notes = [
  {
    icon: CalendarCheck,
    title: "Registration Deadline",
    description: "Please register on or before 31st August 2026. Registration closes when capacity is reached.",
  },
  {
    icon: Clock,
    title: "Check-in & Check-out",
    description: "Check into accommodation by afternoon of 30th October. Checkout by 1st November morning/afternoon.",
  },
  {
    icon: Home,
    title: "Accommodation Priority",
    description: "First-come, first-serve basis with preference to alumni from older batches and those unwell.",
  },
  {
    icon: Users,
    title: "Hostel Grouping",
    description: "We will try, as far as possible, to accommodate all of each batch in the same hostel.",
  },
  {
    icon: Shirt,
    title: "T-Shirt Sizing",
    description: 'S (36"), M (38-40"), L (42"), XL (44") — Please select the correct size during registration.',
  },
];

const ImportantNotes = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">Important Information</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Please review these important details before completing your registration
          </p>
        </motion.div>

        {/* Hard Refresh Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center"
        >
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            ⚠️ Hard refresh the browser before proceeding to fill the Registration Form
          </p>
          <p className="text-amber-600 dark:text-amber-500 text-sm mt-1">
            <span className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">Ctrl + Shift + R</span> (Windows/Linux) or <span className="font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">Cmd + Shift + R</span> (Mac)
          </p>
        </motion.div>

        {/* Eligibility Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 bg-secondary/10 border border-secondary/20 rounded-xl p-8 text-center"
        >
          <h3 className="font-serif text-2xl font-semibold text-foreground mb-3">Eligibility Criteria</h3>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Only batches prior to and including <strong className="text-foreground">ICSE 2018 / ISC 2020</strong> can
            register.
            <br />
            Registration will be opened in phases, starting with earlier batches.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note, index) => (
            <motion.div
              key={note.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="gradient-card rounded-xl p-6 border border-border shadow-soft hover:shadow-card transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <note.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground mb-2">{note.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{note.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default ImportantNotes;
