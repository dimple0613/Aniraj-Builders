import { Input } from "@/components/ui/input";

interface HiddenProps {
    name: string;
    value: number | string;
}

export function Hidden({ name, value }: HiddenProps) {
    return (
        <Input
            type="hidden"
            name={name}
            value={value}
        />
    );
}
