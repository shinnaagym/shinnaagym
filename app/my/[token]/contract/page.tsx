import { notFound } from "next/navigation";
import { getMemberByToken } from "@/lib/schedule";
import { getLatestContractByMember } from "@/lib/contracts";
import { ContractDocument } from "@/app/components/ContractDocument";
import { SignaturePad } from "./signature-pad";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);
  if (!member) {
    notFound();
  }

  const contract = await getLatestContractByMember(member.id);
  if (!contract) {
    notFound();
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <ContractDocument memberName={member.name} memberPhone={member.phone} contract={contract}>
          {contract.signed_at ? (
            <div className="rounded-2xl border border-sage/40 bg-sage/10 px-6 py-6">
              <p className="font-display text-lg mb-3">회원 서명</p>
              {contract.signature_data_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.signature_data_url}
                  alt="회원 서명"
                  className="h-32 rounded-lg border border-line bg-white"
                />
              )}
              <p className="text-xs text-ink/50 mt-2">{formatDateTime(contract.signed_at)} 서명 완료</p>
            </div>
          ) : (
            <SignaturePad token={token} contractId={contract.id} />
          )}
        </ContractDocument>
      </div>
    </main>
  );
}
