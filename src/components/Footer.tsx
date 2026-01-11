import { Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container max-w-6xl px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* About */}
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4">Rishi Valley School</h3>
            <p className="text-background/70 leading-relaxed">
              Celebrating 100 years of holistic education in the heart of nature. 
              Join us for the Alumni Meet 2026 as we commemorate this historic milestone.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-serif text-xl font-semibold mb-4">Contact Us</h3>
            <div className="space-y-3">
              <a 
                href="mailto:alumnimeet@rishivalley.org" 
                className="flex items-center gap-3 text-background/70 hover:text-background transition-colors"
              >
                <Mail className="w-5 h-5" />
                alumnimeet@rishivalley.org
              </a>
              <div className="flex items-start gap-3 text-background/70">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  Rishi Valley School<br />
                  Rishi Valley P.O.<br />
                  Madanapalle, Andhra Pradesh 517352
                </span>
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div>
            <h3 className="font-serif text-xl font-semibold mb-4">Event Details</h3>
            <div className="space-y-2 text-background/70">
              <p><strong className="text-background">Dates:</strong> 30 & 31 October 2026</p>
              <p><strong className="text-background">Registration Deadline:</strong> 31 August 2026</p>
              <p><strong className="text-background">Venue:</strong> Rishi Valley Campus</p>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 mt-12 pt-8 text-center text-background/50">
          <p>&copy; 2026 Rishi Valley School Alumni Association. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
