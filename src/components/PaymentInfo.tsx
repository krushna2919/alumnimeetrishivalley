import { motion } from "framer-motion";
import { Building2, CreditCard, Mail, AlertCircle } from "lucide-react";
import paymentQR from "@/assets/payment-qr.png";
const PaymentInfo = () => {
  return (
    <section className="py-20 bg-secondary text-secondary-foreground">
      <div className="container max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            Payment Information
          </h2>
          <p className="text-secondary-foreground/70 text-lg max-w-2xl mx-auto">
            Complete your registration by making the payment through one of the following methods
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Bank Transfer */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-secondary-foreground/5 backdrop-blur-sm rounded-2xl p-8 border border-secondary-foreground/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-secondary-foreground/10 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-2xl font-semibold">Bank Transfer</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-secondary-foreground/5 rounded-lg p-4">
                <p className="text-sm text-secondary-foreground/60 mb-1">Account Name</p>
                <p className="font-semibold">K.F.I.R.V.E.C. Institute of Educational Resources</p>
              </div>
              
              <div className="bg-secondary-foreground/5 rounded-lg p-4">
                <p className="text-sm text-secondary-foreground/60 mb-1">Bank</p>
                <p className="font-semibold">State Bank of India, Society Colony Branch, Madanapalle</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary-foreground/5 rounded-lg p-4">
                  <p className="text-sm text-secondary-foreground/60 mb-1">Account No.</p>
                  <p className="font-mono font-semibold">54035227556</p>
                </div>
                <div className="bg-secondary-foreground/5 rounded-lg p-4">
                  <p className="text-sm text-secondary-foreground/60 mb-1">IFSC Code</p>
                  <p className="font-mono font-semibold">SBIN0040002</p>
                </div>
              </div>

              <div className="bg-secondary-foreground/5 rounded-lg p-4">
                <p className="text-sm text-secondary-foreground/60 mb-1">Swift Code</p>
                <p className="font-mono font-semibold">SBININBB324</p>
              </div>
            </div>
          </motion.div>

          {/* QR Code / Important Notes */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-secondary-foreground/5 backdrop-blur-sm rounded-2xl p-8 border border-secondary-foreground/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-secondary-foreground/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-2xl font-semibold">UPI / QR Code</h3>
              </div>
              <p className="text-secondary-foreground/70 mb-6">
                Scan the QR code below to pay via UPI
              </p>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <img 
                    src={paymentQR} 
                    alt="Payment QR Code" 
                    className="w-48 h-48 object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="bg-accent/20 backdrop-blur-sm rounded-2xl p-8 border border-accent/30">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-accent" />
                <h3 className="font-serif text-xl font-semibold text-accent-foreground">After Payment</h3>
              </div>
              <p className="text-foreground/80 mb-4">
                Please remember to inform the details of the transfer immediately by email to:
              </p>
              <a 
                href="mailto:alumnimeet@rishivalley.org"
                className="inline-block bg-accent text-accent-foreground font-semibold px-6 py-3 rounded-full hover:bg-accent/90 transition-colors"
              >
                alumnimeet@rishivalley.org
              </a>
            </div>
          </motion.div>
        </div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 bg-destructive/10 border border-destructive/20 rounded-xl p-6 flex items-start gap-4"
        >
          <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground mb-1">Registration Fees are Non-Refundable</p>
            <p className="text-muted-foreground">
              Please ensure all details are correct before completing your payment.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PaymentInfo;
