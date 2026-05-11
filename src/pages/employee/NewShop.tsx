import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTracking } from '../../context/TrackingContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Camera, MapPin, CheckCircle, Loader2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const shopSchema = z.object({
  shopName: z.string().min(2, "Shop Name is required"),
  ownerName: z.string().min(2, "Owner Name is required"),
  phone: z.string().min(10, "Valid phone needed"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Invalid PinCode"),
  category: z.string().min(1, "Select category"),
});

export default function NewShop() {
  const { user } = useAuth();
  const { currentPosition, refreshLocation } = useTracking();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<{ selfieWithShop: string | null }>({ selfieWithShop: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(shopSchema)
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos({ selfieWithShop: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

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
        selfieWithShopImage: photos.selfieWithShop, // In production, upload to S3/Firebase Storage and save URL
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setSuccess(true);
      setTimeout(() => navigate('/employee'), 2000);
    } catch (err) {
      console.error(err);
      alert("Error saving shop. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Shop Registered!</h2>
        <p className="text-zinc-500">Wait for admin approval.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold">Register New Shop</h2>
        <p className="text-zinc-500">Add a new business location to your territory.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Photo Section */}
        <div className="max-w-xs mx-auto">
          <PhotoUpload 
            label="Selfie with Shop" 
            id="selfie-shop-upload" 
            preview={photos.selfieWithShop} 
            onChange={handleFileChange} 
            capture="environment"
          />
        </div>

        {/* GPS Badge */}
        <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
          <MapPin className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest">Geolocation Capture</p>
            <p className="text-sm font-medium">
              {currentPosition ? `${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}` : 'Waiting for GPS...'}
            </p>
          </div>
          <button 
            type="button"
            onClick={refreshLocation}
            className="px-3 py-1 flex items-center justify-center bg-blue-100 text-blue-800 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          <InputGroup label="Shop Name" {...register('shopName')} error={errors.shopName?.message} />
          <InputGroup label="Owner Name" {...register('ownerName')} error={errors.ownerName?.message} />
          <InputGroup label="Phone Number" {...register('phone')} error={errors.phone?.message} />
          <div className="grid grid-cols-2 gap-4">
             <InputGroup label="Shop Category" list="categories" {...register('category')} error={errors.category?.message} />
             <datalist id="categories">
                <option value="Grocery" />
                <option value="Electronics" />
                <option value="Apparel" />
                <option value="Pharmacy" />
             </datalist>
          </div>
          <InputGroup label="Full Address" {...register('address')} error={errors.address?.message} />
          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="City" {...register('city')} error={errors.city?.message} />
            <InputGroup label="State" {...register('state')} error={errors.state?.message} />
            <InputGroup label="PIN" {...register('pincode')} error={errors.pincode?.message} />
          </div>
        </div>

        <button 
          disabled={isSubmitting}
          className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Shop & Submit'}
        </button>
      </form>
    </div>
  );
}

const PhotoUpload = ({ label, id, preview, onChange, capture }: any) => (
  <div className="space-y-2">
    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</p>
    <label 
      htmlFor={id}
      className="relative flex flex-col items-center justify-center aspect-square bg-zinc-100 border-2 border-dashed border-zinc-200 rounded-2xl cursor-pointer hover:bg-zinc-50 transition-all overflow-hidden"
    >
      {preview ? (
        <img src={preview} alt="preview" className="w-full h-full object-cover" />
      ) : (
        <>
          <Camera className="w-8 h-8 text-zinc-300 mb-2" />
          <span className="text-[10px] font-bold text-zinc-400">Click to Open Camera</span>
        </>
      )}
      <input type="file" id={id} className="hidden" accept="image/*" capture={capture} onChange={onChange} />
    </label>
  </div>
);

const InputGroup = React.forwardRef(({ label, error, ...props }: any, ref: any) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">{label}</label>
    <input ref={ref} {...props} className="input-field" />
    {error && <p className="text-red-500 text-[10px] ml-1 font-medium">{error}</p>}
  </div>
));
