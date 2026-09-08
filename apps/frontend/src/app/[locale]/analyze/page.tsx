'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/routing';
import { Upload, Camera, AlertTriangle, Check, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { SubscriptionPaywallModal } from '@/components/SubscriptionPaywallModal';

interface AnalysisResult {
  analysisId: string;
  imageUrl: string;
  nutrition: {
    foodName: string;
    portionSize: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    confidenceScore: number;
    ingredients: string[];
    healthAdvice: string | null;
    portionBreakdown: string | null;
  };
  warning: string | null;
}

const MEAL_TYPES = [
  { value: 'BREAKFAST', emoji: '🌅' },
  { value: 'LUNCH', emoji: '☀️' },
  { value: 'DINNER', emoji: '🌙' },
  { value: 'SNACK', emoji: '🍎' },
] as const;

export default function AnalyzePage() {
  const t = useTranslations('meal');
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'uz';
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { hasAccess } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<string>('LUNCH');

  // Editable fields
  const [editValues, setEditValues] = useState({
    foodName: '', portionSize: '', calories: 0, protein: 0, fat: 0, carbs: 0,
  });

  // ─── Analyze Mutation ──────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post<AnalysisResult>(`/meals/analyze?locale=${locale}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      });
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setEditValues({
        foodName: data.nutrition.foodName,
        portionSize: data.nutrition.portionSize,
        calories: data.nutrition.calories,
        protein: data.nutrition.protein,
        fat: data.nutrition.fat,
        carbs: data.nutrition.carbs,
      });
    },
    onError: (err: any) => {
      console.error('[Food Analysis Error]:', err);
      const serverMessage =
        err?.response?.data?.message ||
        err?.message ||
        (locale === 'ru'
          ? 'Ошибка при анализе'
          : locale === 'en'
            ? 'Analysis error'
            : 'Tahlilda xatolik');
      toast.error(typeof serverMessage === 'string' ? serverMessage : JSON.stringify(serverMessage), { duration: 6000 });
    },
  });

  // ─── Confirm Mutation ──────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: async () => {
      await api.post('/meals/confirm', {
        analysisId: result!.analysisId,
        mealType: selectedMeal,
        ...editValues,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(t('success_save'));
      router.push('/dashboard');
    },
    onError: () => {
      toast.error(
        locale === 'ru' 
          ? 'Ошибка при сохранении' 
          : locale === 'en' 
          ? 'Failed to save' 
          : 'Saqlashda xatolik'
      );
    },
  });

  // ─── Client-side Image Compression Helper ──────────
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size < 600 * 1024) return resolve(file);

      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          0.85,
        );
      };
      img.onerror = () => resolve(file);
    });
  };

  // ─── File Selection ────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasAccess) {
      setPaywallOpen(true);
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload with compression
    setResult(null);
    analyzeMutation.reset();
    try {
      const uploadFile = await compressImage(file);
      analyzeMutation.mutate(uploadFile);
    } catch {
      analyzeMutation.mutate(file);
    }
  };

  return (
    <main className="min-h-screen pb-12 bg-transparent">
      <SubscriptionPaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />

      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-all hover:-translate-x-1"
        >
          <ArrowLeft size={16} />
          {t('back_dashboard')}
        </button>
        <h1 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          {t('analyze_title')}
        </h1>
      </header>

      {/* Responsive layout container */}
      <div className="max-w-5xl mx-auto px-6 mt-2 grid grid-cols-1 lg:grid-cols-12 gap-8 page-enter items-start">
        
        {/* Left Side: Upload zone / Compact image preview, and Meal Time selector */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Upload Button or Compact Image Preview Container */}
          <div className="glass rounded-3xl p-5 shadow-xl text-center dark:bg-slate-900/50 dark:border-slate-800">
            {!preview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-square max-w-[240px] mx-auto rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white/60 dark:bg-slate-950/20 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-emerald-950/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera size={26} className="text-green-600 dark:text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-slate-300">{t('dropzone_text')}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 font-semibold">{t('dropzone_sub')}</p>
                </div>
              </button>
            ) : (
              <div className="relative w-full aspect-square max-w-[240px] mx-auto rounded-3xl overflow-hidden shadow-lg border border-gray-150/60 dark:border-slate-800">
                <img src={preview} alt="Meal preview" className="w-full h-full object-cover" />
                {analyzeMutation.isPending && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="text-emerald-400 animate-spin" />
                    <p className="text-[10px] text-white uppercase font-bold tracking-wider animate-pulse">{t('analyzing')}</p>
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={handleFileSelect}
            />
            
            {/* Error Message when upload/analysis failed */}
            {analyzeMutation.isError && (
              <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2.5 text-left page-enter">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {typeof analyzeMutation.error?.response?.data?.message === 'string'
                    ? analyzeMutation.error.response.data.message
                    : (locale === 'ru'
                        ? 'На фото не обнаружена еда. Пожалуйста, сделайте чёткое фото блюда.'
                        : locale === 'en'
                          ? 'No food detected. Please take a clear photo of your dish.'
                          : 'Rasmdan ovqat aniqlanmadi. Iltimos, taom rasmini yuklang.')}
                </span>
              </div>
            )}

            {/* Quick Retake Action if preview is shown */}
            {preview && !analyzeMutation.isPending && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm hover:scale-105 active:scale-95"
              >
                {t('upload_another')}
              </button>
            )}
          </div>

          {/* Meal Type Selector (only after analyzing successfully) */}
          {result && (
            <div className="glass rounded-3xl p-5 shadow-xl space-y-4 dark:bg-slate-900/50 dark:border-slate-800">
              <p className="text-xs font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wider mb-2">{t('meal_time')}</p>
              <div className="grid grid-cols-4 gap-2">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setSelectedMeal(m.value)}
                    className={`py-2 rounded-xl text-center transition-all border flex flex-col items-center justify-center ${
                      selectedMeal === m.value
                        ? 'border-green-500 bg-green-50 dark:bg-emerald-950/30 text-green-700 dark:text-emerald-400 shadow-sm'
                        : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <p className="text-[9px] font-bold text-gray-600 dark:text-slate-400 mt-1 uppercase tracking-wide">
                      {m.value === 'BREAKFAST' ? t('breakfast') : m.value === 'LUNCH' ? t('lunch') : m.value === 'DINNER' ? t('dinner') : t('snack')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirm/Save Button */}
          {result && (
            <button
              type="button"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-xl shadow-green-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {confirmMutation.isPending ? (
                <><Loader2 size={18} className="animate-spin" /> {t('saving')}</>
              ) : (
                <><Check size={18} /> {t('confirm')}</>
              )}
            </button>
          )}

        </div>

        {/* Right Side: Analysis edit form, nutrition results, and AI feedback card */}
        <div className="lg:col-span-7 space-y-6">
          
          {result ? (
            <div className="space-y-6">
              
              {/* Warning */}
              {result.warning && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 page-enter">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">{t('confidence_warning')}</p>
                </div>
              )}

              {/* Nutrition Fields */}
              <div className="glass rounded-3xl p-6 shadow-xl space-y-4 dark:bg-slate-900/50 dark:border-slate-800">
                <h2 className="text-xs font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wider mb-2">{t('analysis_result')}</h2>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('calories')}</label>
                  <input
                    type="text"
                    value={editValues.foodName}
                    onChange={(e) => setEditValues((v) => ({ ...v, foodName: e.target.value }))}
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'calories', label: t('calories'), unit: 'kcal', color: 'text-red-500 dark:text-red-400' },
                    { key: 'protein', label: t('protein'), unit: 'g', color: 'text-blue-500 dark:text-blue-400' },
                    { key: 'fat', label: t('fat'), unit: 'g', color: 'text-amber-500 dark:text-amber-400' },
                    { key: 'carbs', label: t('carbs'), unit: 'g', color: 'text-purple-500 dark:text-purple-400' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className={`text-[10px] ${f.color} font-bold uppercase tracking-wider`}>{f.label} ({f.unit})</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={(editValues as any)[f.key]}
                        onChange={(e) => setEditValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                        className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Ingredients list */}
              {result.nutrition.ingredients && result.nutrition.ingredients.length > 0 && (
                <div className="glass rounded-3xl p-6 shadow-xl space-y-3 dark:bg-slate-900/50 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-gray-455 dark:text-slate-400 uppercase tracking-wider">
                    🍎 {t('ingredients_title')}
                  </h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {result.nutrition.ingredients.map((ing, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-green-50 dark:bg-emerald-950/20 text-green-700 dark:text-emerald-450 rounded-xl text-xs font-bold border border-green-150/40 dark:border-emerald-900/30 hover:scale-105 transition-transform">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Component breakdown */}
              {result.nutrition.portionBreakdown && (
                <div className="glass rounded-3xl p-6 shadow-xl space-y-3 dark:bg-slate-900/50 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-gray-455 dark:text-slate-400 uppercase tracking-wider">
                    ⚖️ {t('portion_title')}
                  </h3>
                  <p className="text-xs text-gray-650 dark:text-slate-350 whitespace-pre-line leading-relaxed font-bold bg-white/40 dark:bg-slate-900 p-4 rounded-2xl border border-gray-100/50 dark:border-slate-800/80">
                    {result.nutrition.portionBreakdown}
                  </p>
                </div>
              )}

              {/* Dietician feedback */}
              {result.nutrition.healthAdvice && (
                <div className="glass rounded-3xl p-6 shadow-xl space-y-3 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-transparent dark:from-slate-900/30 dark:to-transparent border border-green-200/40 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-500 shrink-0" />
                    {t('dietician_advice_title')}
                  </h3>
                  <p className="text-xs text-emerald-900/80 dark:text-slate-300 whitespace-pre-line leading-relaxed font-semibold bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-emerald-100/40 dark:border-slate-800 shadow-sm">
                    {result.nutrition.healthAdvice}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="glass rounded-3xl p-10 shadow-xl text-center space-y-4 dark:bg-slate-900/50 dark:border-slate-800 lg:min-h-[300px] flex flex-col justify-center items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-2">
                <Upload size={28} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                {locale === 'ru' 
                  ? 'Ожидание анализа блюда' 
                  : locale === 'en' 
                  ? 'Awaiting Meal Analysis' 
                  : 'Taom tahlilini kutish'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {locale === 'ru' 
                  ? 'Пожалуйста, сделайте фото или загрузите изображение вашего блюда слева. Наш искусственный интеллект мгновенно разберет его состав!' 
                  : locale === 'en' 
                  ? 'Please take a photo or upload an image of your meal on the left. Our AI will analyze its composition instantly!'
                  : 'Iltimos, chap tomondan taom rasmini yuklang yoki kameraga oling. Sun\'iy intellektimiz taom tarkibini tahlil qilib beradi!'}
              </p>
            </div>
          )}

        </div>

      </div>
    </main>
  );
}
