import { User, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export interface AdditionalRegistrantData {
  name: string;
  gender: "M" | "F";
  tshirtSize: "S" | "M" | "L" | "XL";
  stayType: "on-campus" | "outside";
}

interface AdditionalRegistrantProps {
  index: number;
  data: AdditionalRegistrantData;
  onChange: (data: AdditionalRegistrantData) => void;
  onRemove: () => void;
}

const AdditionalRegistrant = ({ index, data, onChange, onRemove }: AdditionalRegistrantProps) => {
  const handleChange = (field: keyof AdditionalRegistrantData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const fee = data.stayType === "on-campus" ? "₹15,000" : "₹7,500";

  return (
    <div className="p-6 rounded-xl border-2 border-border bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Person {index + 2}
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Remove
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground">Full Name</Label>
          <Input
            placeholder="Enter full name"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Gender</Label>
          <Select value={data.gender} onValueChange={(v) => handleChange("gender", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Male</SelectItem>
              <SelectItem value="F">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">T-Shirt Size</Label>
          <Select value={data.tshirtSize} onValueChange={(v) => handleChange("tshirtSize", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">S (Chest: 36")</SelectItem>
              <SelectItem value="M">M (Chest: 38-40")</SelectItem>
              <SelectItem value="L">L (Chest: 42")</SelectItem>
              <SelectItem value="XL">XL (Chest: 44")</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Registration Type</Label>
          <RadioGroup
            value={data.stayType}
            onValueChange={(v) => handleChange("stayType", v)}
            className="flex gap-4"
          >
            <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
              data.stayType === "on-campus" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}>
              <RadioGroupItem value="on-campus" />
              <span className="text-sm">On Campus (₹15,000)</span>
            </label>
            <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
              data.stayType === "outside" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}>
              <RadioGroupItem value="outside" />
              <span className="text-sm">Outside (₹7,500)</span>
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="text-right">
        <span className="text-sm text-muted-foreground">Fee: </span>
        <span className="font-semibold text-primary">{fee}</span>
      </div>
    </div>
  );
};

export default AdditionalRegistrant;
