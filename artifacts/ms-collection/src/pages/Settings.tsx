import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useReceiptStore } from "@/store/receipts";
import { Settings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const schema = z.object({
  businessName: z.string().min(1, "Nama bisnis wajib diisi"),
  businessPhone: z.string().optional().default(""),
  businessAddress: z.string().optional().default(""),
  defaultNotes: z.string().optional().default(""),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { settings, updateSettings, load, loaded } = useReceiptStore();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: settings.businessName,
      businessPhone: settings.businessPhone,
      businessAddress: settings.businessAddress,
      defaultNotes: settings.defaultNotes,
    },
  });

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  useEffect(() => {
    form.reset({
      businessName: settings.businessName,
      businessPhone: settings.businessPhone,
      businessAddress: settings.businessAddress,
      defaultNotes: settings.defaultNotes,
    });
  }, [settings, form]);

  const onSubmit = async (data: FormData) => {
    const s: Settings = {
      businessName: data.businessName,
      businessPhone: data.businessPhone ?? "",
      businessAddress: data.businessAddress ?? "",
      defaultNotes: data.defaultNotes ?? "",
    };
    await updateSettings(s);
    toast({ title: "Pengaturan disimpan" });
  };

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Konfigurasi informasi bisnis</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-card border border-border rounded-2xl p-6 space-y-5"
      >
        <h2 className="text-base font-semibold">Informasi Bisnis</h2>
        <p className="text-xs text-muted-foreground -mt-3">
          Informasi ini akan muncul di header PDF nota.
        </p>

        <div className="space-y-1.5">
          <Label>Nama Bisnis</Label>
          <Input
            {...form.register("businessName")}
            data-testid="input-business-name"
            placeholder="MS Collection"
          />
          {form.formState.errors.businessName && (
            <p className="text-xs text-red-500">{form.formState.errors.businessName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Nomor Telepon</Label>
          <Input
            {...form.register("businessPhone")}
            data-testid="input-business-phone"
            placeholder="08xxxxxxxxxx"
            type="tel"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Alamat</Label>
          <Textarea
            {...form.register("businessAddress")}
            data-testid="input-business-address"
            placeholder="Alamat lengkap bisnis..."
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Catatan Default</Label>
          <Textarea
            {...form.register("defaultNotes")}
            data-testid="input-default-notes"
            placeholder="Catatan yang akan muncul di setiap nota..."
            rows={3}
          />
        </div>

        <Button type="submit" data-testid="button-save-settings" className="w-full">
          <Save className="w-4 h-4 mr-2" /> Simpan Pengaturan
        </Button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl p-6 space-y-3"
      >
        <h2 className="text-base font-semibold">Tentang Aplikasi</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>MS Collection v1.0</p>
          <p>Sistem Manajemen Nota Seragam & Apparel</p>
          <p className="text-xs mt-2">
            Data tersimpan secara lokal di browser. Tidak ada data yang dikirim ke server.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
