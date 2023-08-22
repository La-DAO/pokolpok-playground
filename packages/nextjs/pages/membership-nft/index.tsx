import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import axios from "axios";
import toast from "react-hot-toast";
import { useDebounce } from "usehooks-ts";
import { useAccount, useContractReads, useContractWrite, useWaitForTransaction } from "wagmi";
import { MembershipContract } from "~~/contracts/MembershipContract";
import { useOutsideClick } from "~~/hooks/scaffold-eth";
import { ContractAbi } from "~~/utils/scaffold-eth/contract";

const FRUTERO_MEMBERSHIP_IMAGEURI =
  "https://bafybeicpfmbdpxum7itdparhqilo2rtiihe7zk4axigqgtmeerdj5kyara.ipfs.w3s.link/frutero-init.png";

const validUsername = new RegExp("^[a-zA-Z0-9]+$");

const COLOR_VALUES = ["rojo", "rosa", "naranja", "amarillo", "verde", "azul", "morado"];

const ROLE_VALUES = ["hacker", "hipster", "hustler"];

const MintMembershipNFT = () => {
  const [aliasInputValue, setAliasInputValue] = useState("");
  const [descriptionInputValue, setDescriptionInputValue] = useState("");
  const [colorInputValue, setColorInputValue] = useState("");
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [roleInputValue, setRoleInputValue] = useState("");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);

  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedAliasValue = useDebounce(aliasInputValue, 500);

  const { address: userAddress, isConnected } = useAccount();

  useOutsideClick(
    colorDropdownRef,
    useCallback(() => setIsColorDropdownOpen(false), []),
  );

  useOutsideClick(
    roleDropdownRef,
    useCallback(() => setIsRoleDropdownOpen(false), []),
  );

  const membershipContract = {
    address: process.env.NEXT_PUBLIC_MEMBERSHIP_CONTRACT,
    abi: MembershipContract.abi as unknown as ContractAbi,
  };

  const {
    data: contractReadsData,
    isError: isContractReadsError,
    error: contractsReadError,
  } = useContractReads({
    contracts: [
      {
        ...membershipContract,
        functionName: "name",
      },
      {
        ...membershipContract,
        functionName: "symbol",
      },
      {
        ...membershipContract,
        functionName: "totalSupply",
      },
      {
        ...membershipContract,
        functionName: "balanceOf",
        args: [userAddress as string],
      },
      {
        ...membershipContract,
        functionName: "usernameToAddress",
        args: [debouncedAliasValue],
      },
    ],
  });

  const {
    data: writeData,
    error: writeError,
    isError: isWriteError,
    isLoading: isWriteLoading,
    writeAsync,
  } = useContractWrite({
    address: process.env.NEXT_PUBLIC_MEMBERSHIP_CONTRACT,
    abi: MembershipContract.abi,
    functionName: "safeMint",
  });

  const {
    isLoading: isWaitForTxLoading,
    isSuccess: isWaitForTxSuccess,
    isError: isWaitForTxError,
    error: waitForTxError,
  } = useWaitForTransaction({
    hash: writeData?.hash,
  });

  useEffect(() => {
    if (isWaitForTxSuccess && isLoadingState) {
      toast.success(`El NFT fue acuñado exitosamente ${writeData?.hash}`);
      setIsLoadingState(false);
    }
  }, [isLoadingState, isWaitForTxSuccess, writeData?.hash]);

  useEffect(() => {
    if (isContractReadsError) {
      toast.error(contractsReadError?.message ?? "Ocurrió un error");
      setIsLoadingState(false);
    }
    if (isWriteError) {
      toast.error(writeError?.message ?? "Ocurrió un error");
      setIsLoadingState(false);
    }
    if (isWaitForTxError) {
      toast.error(contractsReadError?.message ?? "Ocurrió un error");
      setIsLoadingState(false);
    }
  }, [
    contractsReadError?.message,
    isContractReadsError,
    isWaitForTxError,
    waitForTxError,
    isWriteError,
    writeError?.message,
  ]);

  const onSubmitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoadingState(true);
    if (!isConnected) return;
    if (aliasInputValue.length < 3 || aliasInputValue.length > 15) {
      toast.error("Tu alias debe contener de 3 a 15 caracteres");
      return;
    }
    if (descriptionInputValue.length < 16 || descriptionInputValue.length > 140) {
      toast.error("Tu descripción debe contener de 16 a 140 caracteres");
      return;
    }
    if (!validUsername.test(aliasInputValue)) {
      toast.error("Solo se aceptan caracteres alfanuméricos");
      return;
    }
    if (colorInputValue === "") {
      toast.error("Escoge el color de tu fruta");
      return;
    }
    if (roleInputValue === "") {
      toast.error("Escoge un perfil");
      return;
    }

    const formData = {
      name: aliasInputValue,
      description: descriptionInputValue,
      imageUri: FRUTERO_MEMBERSHIP_IMAGEURI,
      color: colorInputValue,
      role: roleInputValue,
      generation: 0,
      tokenId: contractReadsData ? Number(contractReadsData[2].result) : -1,
    };

    try {
      const response = await axios.post("/api/upload/metadata", formData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.data) {
        await writeAsync?.({
          args: [userAddress, response.data.uri, debouncedAliasValue],
        });
        toast.success(`Alias saved: ${aliasInputValue}`);
        setAliasInputValue("");
        setDescriptionInputValue("");
        setColorInputValue("");
        setRoleInputValue("");
      }
    } catch (error) {
      console.error(error);
      setIsLoadingState(false);
    }
  };

  return (
    <section className="page lg:!px-24">
      <form
        className="w-full flex flex-col items-center border-2 border-base-300 bg-base-100 rounded-lg gap-y-4 px-8 md:w-3/4 lg:w-full lg:flex-row lg:gap-x-4 lg:py-2 lg:items-center"
        onSubmit={event => onSubmitHandler(event)}
      >
        <div className="mt-16 w-full md:w-3/4 lg:w-3/5 lg:mt-0 lg:px-16">
          <Image
            src={FRUTERO_MEMBERSHIP_IMAGEURI}
            alt="Membership NFT"
            className="w-full rounded-lg"
            height={128}
            width={128}
          />
        </div>
        <div className="w-full md:w-3/4 lg:w-2/5 lg:mt-0 flex flex-col items-center">
          {isContractReadsError ? (
            <h2>Ocurrió un error 🫥</h2>
          ) : (
            <>
              <div className="form-control w-full max-w-xs md:max-w-md lg:max-w-lg">
                {contractReadsData && (
                  <h1 className="hidden lg:block text-3xl lg:mt-16 lg:mb-2">{contractReadsData[0].result as string}</h1>
                )}
                <label className="label">
                  <span className="text-base">Introduce tu alias:</span>
                </label>
                <input
                  type="text"
                  id="alias"
                  name="alias"
                  placeholder="e.g. cosmefulanito"
                  className="input input-bordered border-base-300 bg-secondary-content text-base-300 w-full max-w-xs md:max-w-md lg:max-w-lg"
                  onChange={event => setAliasInputValue(event.target.value)}
                  value={aliasInputValue}
                />
              </div>
              <div className="form-control w-full max-w-xs md:max-w-md lg:max-w-lg">
                <label className="label">
                  <span className="text-base">Una breve descripción:</span>
                </label>
                <textarea
                  className="textarea textarea-bordered text-base border-base-300 bg-secondary-content text-base-300 w-full max-w-xs md:max-w-md lg:max-w-lg"
                  id="description"
                  name="description"
                  onChange={event => setDescriptionInputValue(event.target.value)}
                  placeholder="Tus habilidades o un mantra"
                  rows={3}
                  value={descriptionInputValue}
                ></textarea>
              </div>
              <div
                className={`${
                  isColorDropdownOpen ? "dropdown-open" : "dropdown-close"
                } dropdown dropdown-bottom form-control w-full max-w-xs md:max-w-md lg:max-w-lg`}
                ref={colorDropdownRef}
              >
                <label className="label">
                  <span className="text-base">Cuál es el color de tu fruta:</span>
                </label>
                <label
                  tabIndex={0}
                  className="btn mb-2 bg-base-content text-base-300 capitalize text-base justify-between hover:bg-blue-200"
                  onClick={() => {
                    setIsColorDropdownOpen(prevIsOpenState => !prevIsOpenState);
                  }}
                >
                  {colorInputValue || "Escoge uno"}
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </label>
                {isColorDropdownOpen && (
                  <ul
                    tabIndex={0}
                    className="z-10 dropdown-content menu px-0 py-2 shadow border-2 border-base-200 bg-base-content text-base-300 rounded-lg w-full max-w-xs md:max-w-md lg:max-w-lg"
                  >
                    {COLOR_VALUES.map((color, index) => (
                      <li
                        key={`${color}_value_${index}`}
                        className={`text-base py-2.5 text-base-300 capitalize cursor-pointer ${
                          color === colorInputValue
                            ? "bg-base-200 text-white font-bold"
                            : "font-normal hover:bg-base-100 hover:text-white"
                        }`}
                        onClick={() => {
                          setColorInputValue(color);
                          setIsColorDropdownOpen(false);
                        }}
                      >
                        {color}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div
                className={`${
                  isRoleDropdownOpen ? "dropdown-open" : "dropdown-close"
                } dropdown dropdown-bottom form-control w-full max-w-xs md:max-w-md lg:max-w-lg`}
                ref={roleDropdownRef}
              >
                <label className="label">
                  <span className="text-base">Cuál es tu perfil:</span>
                </label>
                <label
                  tabIndex={0}
                  className="btn mb-2 bg-base-content text-base-300 capitalize text-base justify-between hover:bg-blue-200"
                  onClick={() => {
                    setIsRoleDropdownOpen(prevIsOpenState => !prevIsOpenState);
                  }}
                >
                  {roleInputValue || "Escoge uno"}
                  <span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </span>
                </label>
                {isRoleDropdownOpen && (
                  <ul
                    tabIndex={0}
                    className="z-10 dropdown-content menu px-0 py-2 shadow border-2 border-base-200 bg-base-content text-base-300 rounded-lg w-full max-w-xs md:max-w-md lg:max-w-lg"
                  >
                    {ROLE_VALUES.map((role, index) => (
                      <li
                        key={`${role}_value_${index}`}
                        className={`text-base py-2.5 text-base-300 capitalize cursor-pointer ${
                          role === roleInputValue
                            ? "bg-base-200 text-white font-bold"
                            : "font-normal hover:bg-base-100 hover:text-white"
                        }`}
                        onClick={() => {
                          setRoleInputValue(role);
                          setIsRoleDropdownOpen(false);
                        }}
                      >
                        {role}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="w-full flex justify-center">
                <button
                  className="btn btn-primary w-2/3 lg:w-1/2 my-8"
                  disabled={isWriteLoading || isWaitForTxLoading || isLoadingState}
                >
                  {isWriteLoading || isWaitForTxLoading || isLoadingState ? "Acuñando..." : "Acuñar"}
                  {(isWriteLoading || isWaitForTxLoading || isLoadingState) && (
                    <span className="loading loading-spinner loading-md ml-2"></span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </section>
  );
};

export default MintMembershipNFT;
