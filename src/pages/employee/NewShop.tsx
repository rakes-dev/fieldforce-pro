import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTracking } from '../../context/TrackingContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Camera, MapPin, CheckCircle, Loader2, Upload, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CameraCapture } from '../../components/CameraCapture';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn } from '../../lib/utils';

const shopSchema = z.object({
  shopName: z.string().min(2, "Shop Name is required"),
  ownerName: z.string().min(2, "Owner Name is required"),
  phone: z.string().min(10, "Valid phone needed"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Invalid PinCode"),
});

export default function NewShop() {
  const { user } = useAuth();
  const { currentPosition, refreshLocation } = useTracking();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Identity, 2: Form
  const [photos, setPhotos] = useState<{ selfieWithShop: string | null }>({ selfieWithShop: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(shopSchema)
  });

  const onSubmit = async (data: any) => {
    if (!currentPosition) {
      alert("GPS not ready! Please ensure location permissions are granted.");
      return;
    }
    if (!photos.selfieWithShop) {
      alert("Selfie with Shop photo is mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'shops'), {
        ...data,
        employeeId: user?.uid,
        latitude: currentPosition.lat,
        longitude: currentPosition.lng,
        selfieWithShopImage: photos.selfieWithShop,
        status: 'approved',
        createdAt: serverTimestamp()
      });
      setSuccess(true);
      setTimeout(() => navigate('/employee'), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shops');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-100/50">
          <CheckCircle className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Shop Registered!</h2>
        <p className="text-slate-500 font-medium">The shop is now approved and active immediately.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 pb-24 sm:pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">Shop Registry</h1>
          <p className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1">Authorized Data Entry Phase {step}/2</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
          <X className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex flex-col items-center gap-5 sm:gap-8 py-6 sm:py-10 bg-white rounded-3xl sm:rounded-[40px] shadow-sm border border-slate-100 p-5 sm:p-8"
          >
            <div 
              onClick={() => setIsCameraOpen(true)}
              className="relative w-full aspect-square max-w-[200px] sm:max-w-[260px] rounded-3xl sm:rounded-[40px] overflow-hidden bg-slate-50 border-4 sm:border-8 border-white shadow-xl group cursor-pointer"
            >
              {photos.selfieWithShop ? (
                <img src={photos.selfieWithShop} alt="Selfie" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                  <Camera className="w-12 h-12 mb-2 animate-pulse text-accent/40" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Initialize Camera</span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <div className="px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-white/50 flex items-center gap-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", currentPosition ? "bg-emerald-500 animate-pulse" : "bg-amber-500")}></div>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-700 tracking-wider uppercase">
                    {currentPosition ? "GPS CONNECTED" : "ACQUIRING GPS..."}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center space-y-1 max-w-[280px]">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Identity Check</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">Position yourself with the shop sign clearly visible.</p>
            </div>

            {photos.selfieWithShop ? (
              <div className="w-full space-y-3">
                <button 
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl sm:rounded-[24px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-[1.01] active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                >
                  Confirm & Go to Details <CheckCircle className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsCameraOpen(true)}
                  className="w-full py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Retake Photo
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsCameraOpen(true)}
                className="w-14 h-14 sm:w-20 sm:h-20 bg-accent rounded-full border-4 border-white shadow-lg shadow-accent/20 flex items-center justify-center active:scale-90 transition-all hover:bg-accent/95"
              >
                <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </button>
            )}

            {isCameraOpen && (
              <CameraCapture 
                facingMode="environment"
                onCapture={(base64) => {
                  setPhotos({ selfieWithShop: base64 });
                  setIsCameraOpen(false);
                }}
                onClose={() => setIsCameraOpen(false)}
              />
            )}
          </motion.div>
        ) : (
          <motion.form 
            key="step2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit(onSubmit)} 
            className="space-y-6"
          >
            <div className="p-5 sm:p-8 bg-white rounded-3xl sm:rounded-[40px] shadow-sm border border-slate-100 space-y-5 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 items-stretch">
                <div className="relative rounded-2xl sm:rounded-[32px] overflow-hidden border-4 border-white shadow-md bg-slate-50 group h-32 md:h-full aspect-[16/9] md:aspect-auto">
                  <img src={photos.selfieWithShop!} alt="Verified" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-black uppercase tracking-widest gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Change Selfie
                  </button>
                </div>

                <div className="space-y-4 sm:space-y-6 flex flex-col justify-between">
                  <InputGroup 
                    label="Business Name" 
                    placeholder="Shop Display Name"
                    {...register("shopName")}
                    error={errors.shopName?.message}
                  />
                  <InputGroup 
                    label="Owner Identity" 
                    placeholder="Contact Person Name"
                    {...register("ownerName")}
                    error={errors.ownerName?.message}
                  />
                  <InputGroup 
                    label="Verified Mobile" 
                    placeholder="10-digit number"
                    {...register("phone")}
                    error={errors.phone?.message}
                  />
                </div>
              </div>

              <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
                <div className="w-full">
                   <div className="flex items-center gap-3 p-3.5 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-[24px] border border-slate-100 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-accent shrink-0">
                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Geostamp Lock</span>
                        <p className="text-xs font-bold text-slate-700 tracking-tight">
                          {currentPosition 
                            ? `${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}` 
                            : "SIGNAL WEAK"}
                        </p>
                      </div>
                      <button type="button" onClick={refreshLocation} className="ml-auto p-1.5 text-slate-400 hover:text-accent active:scale-90 transition-transform">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                   </div>
                </div>

                <div className="space-y-4">
                  <InputGroup 
                    label="Street Address / Landmark" 
                    placeholder="Full physical location details"
                    {...register("address")}
                    error={errors.address?.message}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <InputGroup label="City" {...register("city")} error={errors.city?.message} />
                    <InputGroup label="State" {...register("state")} error={errors.state?.message} />
                    <InputGroup label="Pincode" {...register("pincode")} error={errors.pincode?.message} />
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !currentPosition}
              className="w-full py-4 sm:py-5 bg-slate-900 text-white rounded-2xl sm:rounded-[32px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/30 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Synchronize & Save
                </>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

const InputGroup = React.forwardRef(({ label, error, ...props }: any, ref: any) => (
  <div className="space-y-1.5">
    <label className="label-minimal">{label}</label>
    <input 
      ref={ref} 
      className={cn("input-minimal", error && "border-red-200 bg-red-50/30 focus:border-red-500")} 
      {...props} 
    />
    {error && <p className="text-[10px] font-bold text-red-500 px-1">{error}</p>}
  </div>
));
