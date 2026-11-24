import { useSettings } from "../context/SettingsContext";

/** Home page story block with an image placeholder. Hidden in Mama Mode (long text). */
export default function StorySection() {
  const { t, mama } = useSettings();
  if (mama) return null;

  return (
    <section className="max-w-5xl mx-auto px-4 py-14">
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden grid md:grid-cols-2">
        {/* Image placeholder - replace with:
            <img src="/founder.jpg" alt="Founder" className="w-full h-full object-cover" /> */}
        <div className="relative min-h-64 bg-gradient-to-br from-emerald-100 via-emerald-50 to-white flex flex-col items-center justify-center gap-3 p-8 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-emerald-300">
          <span className="text-8xl" aria-hidden="true">
            👨🏾‍🎓
          </span>
          <span className="text-xs font-semibold text-emerald-700 bg-white/80 px-3 py-1 rounded-full">
            📷 {t("story.photo")}
          </span>
        </div>

        <div className="p-8 md:p-10 flex flex-col justify-center">
          <span className="text-xs font-bold tracking-wide text-brand uppercase mb-3">
            {t("story.kicker")}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-4">
            {t("story.title")}
          </h2>
          <p className="text-gray-600">{t("story.body")}</p>
        </div>
      </div>
    </section>
  );
}
