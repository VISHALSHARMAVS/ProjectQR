import { useCallback, useState } from 'react';

export type GuestLang = 'en' | 'hi' | 'mr';

export const GUEST_LANG_LABELS: Record<GuestLang, string> = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी'
};

export const GUEST_LANG_SHORT: Record<GuestLang, string> = {
  en: 'EN',
  hi: 'हिं',
  mr: 'मर'
};

const STORAGE_KEY = 'mesa_guest_lang';

function isValidLang(value: string | null | undefined): value is GuestLang {
  return value === 'en' || value === 'hi' || value === 'mr';
}

export function getStoredGuestLang(): GuestLang | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return isValidLang(val) ? val : null;
  } catch {
    return null;
  }
}

export function useGuestLang(restaurantDefault?: GuestLang): [GuestLang, (lang: GuestLang) => void] {
  const [selectedLang, setSelectedLang] = useState<GuestLang | null>(() => getStoredGuestLang());

  const setLang = useCallback((next: GuestLang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures in private browsing
    }
    setSelectedLang(next);
  }, []);

  const effectiveLang: GuestLang = selectedLang ?? (isValidLang(restaurantDefault) ? restaurantDefault : 'en');
  return [effectiveLang, setLang];
}

export interface EntityTranslations {
  hi?: { name?: string; description?: string };
  mr?: { name?: string; description?: string };
}

export function localizeText(
  defaultText: string,
  translations: EntityTranslations | undefined | null,
  lang: GuestLang,
  field: 'name' | 'description' = 'name'
): string {
  if (lang === 'en' || !translations) return defaultText;
  const candidate = translations[lang]?.[field]?.trim();
  return candidate || defaultText;
}

const DICT = {
  en: {
    welcome: 'Welcome',
    whosJoining: "Who's joining us today?",
    enterNamePrompt: 'Enter your name to browse the menu and order together with everyone at {table}.',
    enterPhonePrompt: 'Enter your mobile number to verify your session at {table}.',
    yourName: 'Your Name',
    namePlaceholder: 'e.g. Rahul, Priya, Alex',
    mobileNumber: 'Mobile Number',
    continueToMenu: 'Continue to Menu',
    joiningTable: 'Joining table…',
    sendCode: 'Send Verification Code',
    verifyAndContinue: 'Verify & Continue',
    languageLabel: 'Language',
    browseMenu: 'Menu',
    searchDishes: 'Search dishes…',
    allCategories: 'All',
    veg: 'Veg',
    nonVeg: 'Non-Veg',
    egg: 'Egg',
    bestseller: 'Bestseller',
    chefSpecial: "Chef's Special",
    add: 'Add',
    viewCart: 'View Cart',
    callWaiter: 'Need Help?',
    yourOrder: 'Your Order',
    placeOrder: 'Place Order',
    placingOrder: 'Placing order…',
    backToMenu: 'Back to Menu',
    orderNotes: 'Special cooking instructions (optional)',
    subtotal: 'Subtotal',
    total: 'Total',
    askForBill: 'Ask for Bill',
    choosePaymentMethod: 'How would you like to pay?',
    payCash: 'Cash',
    payCashHint: 'Waiter will bring your bill',
    payCard: 'Card',
    payCardHint: 'Waiter will bring card machine & bill',
    payUpi: 'UPI',
    payUpiHint: 'Pay instantly via UPI / QR',
    sendBillRequest: 'Request Bill ({method})',
    sendingBillRequest: 'Sending request…',
    billRequestedBanner: 'Bill requested ({method}). A team member is on the way to your table!',
    payViaUpiTitle: 'Pay via UPI',
    openUpiApp: 'Open UPI App',
    orScanQr: 'Or scan QR with any UPI app',
    enterUtrPrompt: 'Enter 12-digit UPI Ref / UTR after paying',
    confirmUpiPayment: 'Confirm UPI Payment',
    confirming: 'Confirming…',
    payWithGateway: 'Pay ₹{amount} Now',
    openingCheckout: 'Opening payment…',
    paidBadge: 'Paid',
    rateExperience: 'Rate Your Dining Experience',
    orderMore: 'Order more items',
    rateYourExperienceTitle: 'Rate Your Experience',
    submitFeedback: 'Submit Feedback',
    submitting: 'Submitting…',
    maybeLater: 'Maybe later',
    thankYouHeading: 'Thank you so much!',
    thankYouBody: 'Your feedback means the world to our chefs and floor team. We look forward to serving you again!',
    apologyHeading: "We're sorry for the inconvenience",
    apologyBody: 'Our manager has been informed and is coming to your table shortly to help resolve this.',
    googlePrompt: 'Would you like to share your experience on Google?',
    addGoogleReview: 'Add your review on Google',
    openedGoogleReview: 'Opened Google Reviews',
    done: 'Done',
    assistanceTitle: 'How can we help?',
    requestWater: 'Water',
    requestCutlery: 'Cutlery',
    requestWaiter: 'Call Waiter',
    requestBill: 'Ask for Bill',
    sendRequest: 'Send Request'
  },
  hi: {
    welcome: 'स्वागत है',
    whosJoining: 'आज हमारे साथ कौन जुड़ रहा है?',
    enterNamePrompt: '{table} पर मेन्यू देखने और साथ में ऑर्डर करने के लिए अपना नाम दर्ज करें।',
    enterPhonePrompt: '{table} पर अपना सेशन सत्यापित करने के लिए मोबाइल नंबर दर्ज करें।',
    yourName: 'आपका नाम',
    namePlaceholder: 'जैसे राहुल, प्रिया, अमन',
    mobileNumber: 'मोबाइल नंबर',
    continueToMenu: 'मेन्यू देखें',
    joiningTable: 'जुड़ रहे हैं…',
    sendCode: 'वेरिफिकेशन कोड भेजें',
    verifyAndContinue: 'सत्यापित करें और आगे बढ़ें',
    languageLabel: 'भाषा',
    browseMenu: 'मेन्यू',
    searchDishes: 'डिश खोजें…',
    allCategories: 'सभी',
    veg: 'शाकाहारी',
    nonVeg: 'मांसाहारी',
    egg: 'अंडा',
    bestseller: 'बेस्टसेलर',
    chefSpecial: 'शेफ स्पेशल',
    add: 'जोड़ें',
    viewCart: 'कार्ट देखें',
    callWaiter: 'मदद चाहिए?',
    yourOrder: 'आपका ऑर्डर',
    placeOrder: 'ऑर्डर करें',
    placingOrder: 'ऑर्डर हो रहा है…',
    backToMenu: 'मेन्यू पर वापस',
    orderNotes: 'विशेष निर्देश (वैकल्पिक)',
    subtotal: 'उप-योग',
    total: 'कुल',
    askForBill: 'बिल मांगें',
    choosePaymentMethod: 'आप कैसे भुगतान करना चाहेंगे?',
    payCash: 'कैश',
    payCashHint: 'वेटर आपका बिल लेकर आएंगे',
    payCard: 'कार्ड',
    payCardHint: 'वेटर कार्ड मशीन और बिल लाएंगे',
    payUpi: 'UPI',
    payUpiHint: 'UPI / QR से तुरंत भुगतान करें',
    sendBillRequest: 'बिल मांगें ({method})',
    sendingBillRequest: 'अनुरोध भेजा जा रहा है…',
    billRequestedBanner: 'बिल का अनुरोध ({method}) भेज दिया गया है। हमारे स्टाफ सदस्य आपकी टेबल पर आ रहे हैं!',
    payViaUpiTitle: 'UPI से भुगतान करें',
    openUpiApp: 'UPI ऐप खोलें',
    orScanQr: 'या किसी भी UPI ऐप से QR स्कैन करें',
    enterUtrPrompt: 'भुगतान के बाद 12-अंकों का UTR / रेफरेंस नंबर दर्ज करें',
    confirmUpiPayment: 'UPI भुगतान कन्फर्म करें',
    confirming: 'कन्फर्म हो रहा है…',
    payWithGateway: 'अभी ₹{amount} भुगतान करें',
    openingCheckout: 'पेमेंट खुल रहा है…',
    paidBadge: 'भुगतान हो गया',
    rateExperience: 'अपना अनुभव साझा करें',
    orderMore: 'और आइटम ऑर्डर करें',
    rateYourExperienceTitle: 'अपना अनुभव रेट करें',
    submitFeedback: 'फीडबैक सबमिट करें',
    submitting: 'सबमिट हो रहा है…',
    maybeLater: 'बाद में',
    thankYouHeading: 'बहुत-बहुत धन्यवाद!',
    thankYouBody: 'आपके फीडबैक के लिए धन्यवाद। हमारे शेफ और टीम को आपकी सेवा करके बहुत खुशी हुई!',
    apologyHeading: 'असुविधा के लिए हमें खेद है',
    apologyBody: 'हमारे मैनेजर को सूचित कर दिया गया है और वे आपकी समस्या हल करने के लिए जल्द ही आपकी टेबल पर आ रहे हैं।',
    googlePrompt: 'क्या आप Google पर भी अपना अनुभव साझा करना चाहेंगे?',
    addGoogleReview: 'Google पर अपना रिव्यू जोड़ें',
    openedGoogleReview: 'Google रिव्यू खुल गया',
    done: 'हो गया',
    assistanceTitle: 'हम आपकी क्या मदद कर सकते हैं?',
    requestWater: 'पानी',
    requestCutlery: 'चम्मच / प्लेट',
    requestWaiter: 'वेटर बुलाएं',
    requestBill: 'बिल मांगें',
    sendRequest: 'अनुरोध भेजें'
  },
  mr: {
    welcome: 'स्वागत आहे',
    whosJoining: 'आज आमच्यासोबत कोण येत आहे?',
    enterNamePrompt: '{table} वर मेनू पाहण्यासाठी आणि एकत्र ऑर्डर करण्यासाठी तुमचे नाव टाका.',
    enterPhonePrompt: '{table} वर तुमचे सत्र पडताळण्यासाठी मोबाईल नंबर टाका.',
    yourName: 'तुमचे नाव',
    namePlaceholder: 'उदा. राहुल, प्रिया, अमित',
    mobileNumber: 'मोबाईल नंबर',
    continueToMenu: 'मेनू पहा',
    joiningTable: 'जोडत आहे…',
    sendCode: 'पडताळणी कोड पाठवा',
    verifyAndContinue: 'पडताळणी करा आणि पुढे जा',
    languageLabel: 'भाषा',
    browseMenu: 'मेनू',
    searchDishes: 'पदार्थ शोधा…',
    allCategories: 'सर्व',
    veg: 'शाकाहारी',
    nonVeg: 'मांसाहारी',
    egg: 'अंडे',
    bestseller: 'बेस्टसेलर',
    chefSpecial: 'शेफ स्पेशल',
    add: 'जोडा',
    viewCart: 'कार्ट पहा',
    callWaiter: 'मदत हवी?',
    yourOrder: 'तुमची ऑर्डर',
    placeOrder: 'ऑर्डर करा',
    placingOrder: 'ऑर्डर होत आहे…',
    backToMenu: 'मेनूवर परत जा',
    orderNotes: 'विशेष सूचना (ऐच्छिक)',
    subtotal: 'उप-एकूण',
    total: 'एकूण',
    askForBill: 'बिल मागा',
    choosePaymentMethod: 'तुम्ही पेमेंट कसे करू इच्छिता?',
    payCash: 'रोख (Cash)',
    payCashHint: 'वेटर तुमचे बिल घेऊन येतील',
    payCard: 'कार्ड (Card)',
    payCardHint: 'वेटर कार्ड मशीन आणि बिल घेऊन येतील',
    payUpi: 'UPI',
    payUpiHint: 'UPI / QR द्वारे त्वरित पेमेंट करा',
    sendBillRequest: 'बिल मागा ({method})',
    sendingBillRequest: 'विनंती पाठवत आहे…',
    billRequestedBanner: 'बिलाची विनंती ({method}) पाठवली आहे. आमचा कर्मचारी तुमच्या टेबलवर येत आहे!',
    payViaUpiTitle: 'UPI द्वारे पेमेंट करा',
    openUpiApp: 'UPI अ‍ॅप उघडा',
    orScanQr: 'किंवा कोणत्याही UPI अ‍ॅपने QR स्कॅन करा',
    enterUtrPrompt: 'पेमेंट केल्यानंतर १२-अंकी UTR / संदर्भ क्रमांक टाका',
    confirmUpiPayment: 'UPI पेमेंट निश्चित करा',
    confirming: 'निश्चित करत आहे…',
    payWithGateway: 'आता ₹{amount} भरा',
    openingCheckout: 'पेमेंट उघडत आहे…',
    paidBadge: 'पेमेंट पूर्ण',
    rateExperience: 'तुमचा अनुभव शेअर करा',
    orderMore: 'आणखी पदार्थ ऑर्डर करा',
    rateYourExperienceTitle: 'तुमचा अनुभव रेट करा',
    submitFeedback: 'अभिप्राय सबमिट करा',
    submitting: 'सबमिट होत आहे…',
    maybeLater: 'नंतर',
    thankYouHeading: 'खूप खूप धन्यवाद!',
    thankYouBody: 'तुमच्या अभिप्रायाबद्दल धन्यवाद. आमच्या शेफ आणि टीमला तुमची सेवा करून आनंद झाला!',
    apologyHeading: 'गैरसोयीबद्दल आम्ही दिलगीर आहोत',
    apologyBody: 'आमच्या मॅनेजरला कळवण्यात आले आहे आणि ते तुमची समस्या सोडवण्यासाठी लवकरच तुमच्या टेबलवर येत आहेत.',
    googlePrompt: 'तुम्हाला Google वरही तुमचा अनुभव शेअर करायला आवडेल का?',
    addGoogleReview: 'Google वर तुमचा रिव्ह्यू जोडा',
    openedGoogleReview: 'Google रिव्ह्यू उघडले',
    done: 'पूर्ण झाले',
    assistanceTitle: 'आम्ही तुम्हाला कशी मदत करू शकतो?',
    requestWater: 'पाणी',
    requestCutlery: 'चमचे / प्लेट',
    requestWaiter: 'वेटरला बोलवा',
    requestBill: 'बिल मागा',
    sendRequest: 'विनंती पाठवा'
  }
} as const;

export type TranslationKey = keyof typeof DICT.en;

export function t(key: TranslationKey, lang: GuestLang = 'en', vars?: Record<string, string | number>): string {
  const dict = DICT[lang] ?? DICT.en;
  let text: string = dict[key] ?? DICT.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
