'use client';

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, Eye, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GujaratiDocumentViewProps {
    estimationId: string;
    workName?: string;
    zoneNo?: string;
    contractor?: string;
    estimationNo?: string;
    amount?: string | number;
    monthYear?: string;
}

export default function GujaratiDocumentView({
    estimationId,
    workName = "Water line maintenance work in various places in water zone no. 4 (DEC-25/JAN26)",
    zoneNo = "૦૪",
    contractor = "શ્રી અનીરાજ બિલ્ડર્સ",
    estimationNo = "TI00-00//00",
    amount = "૧,૮૭,૭૭૪",
    monthYear = "ડિસેમ્બર-જાન્યુઆરી ૨૦૨૬"
}: GujaratiDocumentViewProps) {

    const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [formValues, setFormValues] = useState({
        row1Value: "ઝોન નં.૦૪માં પાણીની લાઈનના મરામત કામ",
        row2Value: "વોટર ઝોન નં૦૪માં પાણીની લાઇનના ખુબ અગત્યના અને જરૂરી અલગ અલગ સ્થળોએ પ્રકરણે દર્શાવેલ મુજબ મરામત કામ કરાવેલ છે",
        row3Value: "ભાવનગર મહાનગરપાલિકા",
        row4Value: "મેન્ટેનન્સ કામ (વાર્ષિક ભાવથી)",
        row5Value: "ના",
        row6Value: `ખર્ચ પત્ર મુજબ રૂ. ${amount}/- નો ખર્ચ થયેલ છે`,
        row7Value: "માન. નાયબ કમિશનર સાહેબશ્રી",
        row8Value: "મેન્ટેનન્સ કામ",
        row9Value: "લાગુ નથી",
        row10Value: "લાગુ નથી",
        row11Value: "લાગુ નથી",
        row12Value: "લાગુ નથી",
        row13Value: "લાગુ નથી",
        row14Value: "લાગુ નથી",
        row15Value: "લાગુ નથી",
        row16Value: "લાગુ નથી",
        row17Value: "લાગુ નથી",
        row18Value: "લાગુ નથી",
        row19Value: "લાગુ નથી",
        row20Value: contractor ?? "શ્રી અનિરાજ બિલ્ડર્સ",
        row21Value: "કામનું ડુપ્લીકેશન થતું નથી",
    });

    useEffect(() => {
        const fetchDocument = async () => {
            if (!estimationId) {
                setInitialLoading(false);
                return;
            }

            try {
                const response = await axios.get(`/api/gujarati-document?estimationId=${estimationId}`);
                if (response.data.success && response.data.data) {
                    const doc = response.data.data;
                    setFormValues({
                        row1Value: doc.work_summary || formValues.row1Value,
                        row2Value: doc.work_requirement || formValues.row2Value,
                        row3Value: doc.plot_ownership || formValues.row3Value,
                        row4Value: doc.work_type || formValues.row4Value,
                        row5Value: doc.is_duplicate_work || formValues.row5Value,
                        row6Value: doc.estimated_cost_details || formValues.row6Value,
                        row7Value: doc.approving_authority || formValues.row7Value,
                        row8Value: doc.cost_head || formValues.row8Value,
                        row9Value: doc.work_method || formValues.row9Value,
                        row10Value: doc.work_deadline || formValues.row10Value,
                        row11Value: doc.is_work_completed_on_time || formValues.row11Value,
                        row12Value: doc.registration_class || formValues.row12Value,
                        row13Value: doc.emd_details || formValues.row13Value,
                        row14Value: doc.bid_validity || formValues.row14Value,
                        row15Value: doc.liability_period || formValues.row15Value,
                        row16Value: doc.gfr_pwd_compliance || formValues.row16Value,
                        row17Value: doc.is_single_tender || formValues.row17Value,
                        row18Value: doc.single_tender_efforts || formValues.row18Value,
                        row19Value: doc.negotiation_feedback || formValues.row19Value,
                        row20Value: doc.work_agency || formValues.row20Value,
                        row21Value: doc.hod_certificate_no_duplicate || formValues.row21Value,
                    });
                }
            } catch (error) {
                console.error('Error fetching Gujarati document:', error);
            } finally {
                setInitialLoading(false);
            }
        };

        fetchDocument();
    }, [estimationId]);

    const handleInputChange = (field: string, value: string) => {
        setFormValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const response = await axios.post('/api/gujarati-document', {
                estimationId,
                ...formValues,
            });

            if (response.data.success) {
                toast.success('Gujarati document saved successfully');
            }
        } catch (error) {
            console.error('Error saving Gujarati document:', error);
            toast.error('Failed to save Gujarati document');
        } finally {
            setLoading(false);
        }
    };

    const tableFields = [
        { no: "૧", field: "કામની ટૂંકી વિગત", valueKey: "row1Value" as keyof typeof formValues },
        { no: "૨", field: "કામની જરૂરીયાત", valueKey: "row2Value" as keyof typeof formValues },
        { no: "૩", field: "રસ્તા / પ્લોટની માલિકી", valueKey: "row3Value" as keyof typeof formValues },
        { no: "૪", field: "કામનો પ્રકાર", valueKey: "row4Value" as keyof typeof formValues },
        { no: "૫", field: "આ કામનું ડુપ્લીકેશન થાય છે કે કેમ (હા/ના)", valueKey: "row5Value" as keyof typeof formValues },
        { no: "૬", field: "કામની અંદાજપત્ર / ખર્ચપત્રક મુજબની વિગત", valueKey: "row6Value" as keyof typeof formValues },
        { no: "૭", field: "ખર્ચ મંજૂરી કરનાર સક્ષમ સત્તાધીશ", valueKey: "row7Value" as keyof typeof formValues },
        { no: "૮", field: "ખર્ચનો હેડ", valueKey: "row8Value" as keyof typeof formValues },
        { no: "૯", field: "કામની પદ્ધતિ", valueKey: "row9Value" as keyof typeof formValues },
        { no: "૧૦", field: "કામની સમયમર્યાદા", valueKey: "row10Value" as keyof typeof formValues },
        { no: "૧૧", field: "કામ સમયમર્યાદામાં પૂર્ણ થયેલું છે કે કેમ? (હા/ના)", valueKey: "row11Value" as keyof typeof formValues },
        { no: "૧૨", field: "રજીસ્ટ્રેશન ક્લાસ", valueKey: "row12Value" as keyof typeof formValues },
        { no: "૧૩", field: "EMD ની વિગત", valueKey: "row13Value" as keyof typeof formValues },
        { no: "૧૪", field: "બીડ વેલિડીટી", valueKey: "row14Value" as keyof typeof formValues },
        { no: "૧૫", field: "કામનો લાયબિલિટી પિરિયડ", valueKey: "row15Value" as keyof typeof formValues },
        { no: "૧૬", field: "GFR/PWD શહેરી વિભાગની જોગવાઇઓ સાથે સુસંગત છે કે કેમ?", valueKey: "row16Value" as keyof typeof formValues },
        { no: "૧૭", field: "સિંગલ ટેન્ડર છે કે કેમ?", valueKey: "row17Value" as keyof typeof formValues },
        { no: "૧૮", field: "સિંગલ ટેન્ડર હોય તો કેટલાં પ્રયત્ન થયા છે?", valueKey: "row18Value" as keyof typeof formValues },
        { no: "૧૯", field: "નેગોસિએશન માટે અભિપ્રાય થયો છે", valueKey: "row19Value" as keyof typeof formValues },
        { no: "૨૦", field: "કામની એજન્સી", valueKey: "row20Value" as keyof typeof formValues },
        { no: "૨૧", field: "આ કામનું ડુપ્લીકેશન થતું નથી તે બાબતનું HOD નું પ્રમાણપત્ર", valueKey: "row21Value" as keyof typeof formValues },
    ];

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="bg-white p-4 md:p-6" style={{ fontFamily: "'Noto Sans Gujarati', 'Nirmala UI', sans-serif" }}>
            {/* Header with Edit/Preview Toggle and Save Button */}
            <div className="flex items-center gap-2 mb-[10px]">
                <div className="flex bg-slate-100 rounded-lg p-1  ml-auto">
                    <Button
                        type="button"
                        variant={viewMode === "edit" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("edit")}
                        className="gap-1"
                    >
                        <Edit3 className="h-3 w-3" />
                        <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                        type="button"
                        variant={viewMode === "preview" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("preview")}
                        className="gap-1"
                    >
                        <Eye className="h-3 w-3" />
                        <span className="hidden sm:inline">Preview</span>
                    </Button>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    size="sm"
                    className="shadow-md print:hidden"
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    <Save className="h-4 w-4 mr-1" />
                    Save
                </Button>
            </div>
            <div className="flex items-center justify-between mb-6">
                <div className="text-center shadow-md flex-1 text-center rounded-md border overflow-hidden flex-1 pt-[10px] px-[20px] pb-[30px]">
                    <h1 className="font-bold mb-1 text-[36px] leading-[53px]">
                        ભવનગર મહાનગરપાલિકા
                    </h1>
                    <span className="text-[22px] font-[600]">વિભાગ :- વોટર વર્કસ વિભાગ</span>
                </div>

            </div>

            {/* Intro Line */}
            <div className="text-left mb-4">
                <p className="text-sm font-bold">સાદર રજૂ.</p>
            </div>

            {/* Work Name */}
            <div className="mb-4">
                <p className="text-sm font-medium">
                    <span className="font-semibold">કામનું નામ :</span> {workName}
                </p>
            </div>

            {/* Main Table */}
            <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm border-collapse">
                    <tbody>
                        {tableFields.map((row, index) => (
                            <tr key={index}>
                                <td className="p-2 py-1 border text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ({row.no})
                                </td>
                                <td className="p-2 py-1 border text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    {row.field}
                                </td>
                                <td className="p-3 py-2 border text-left text-xs  ">
                                    {viewMode === "edit" ? (
                                        <Input
                                            value={formValues[row.valueKey]}
                                            onChange={(e) => handleInputChange(row.valueKey, e.target.value)}
                                            className="h-7 text-sm font-normal border-gray-300"
                                        />
                                    ) : (
                                        <span className="text-sm">{formValues[row.valueKey]}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Section */}
            <div className="pt-4 hidden mt-12 flex w-[57%] mx-auto">
                <div className="w-1/2 text-center">
                    <p className="font-bold">ટે.આ/અ.મ.ઈ.</p>
                </div>

                <div className="font-bold w-1/2 text-center">
                    <p>ક.ઈ.</p>
                </div>
            </div>
        </div>
    );
}
